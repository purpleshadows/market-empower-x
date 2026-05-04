import fs from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { execFileSync } from 'child_process'

//
// Next.js specifics to be used in getStaticProps / getStaticPaths
// to automatically generate pages from Markdown files in `src/pages/[slug].tsx`.
//
// const pagesDirectory = join(process.cwd(), 'content', 'pages')
const pagesDirectory = './content/pages'
export interface PageData {
  slug: string
  frontmatter: { [key: string]: any }
  content: string
  fileLastUpdated: string
}

let hasGitBinary: boolean | undefined

function canUseGit(): boolean {
  if (hasGitBinary !== undefined) return hasGitBinary

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' })
    hasGitBinary = true
  } catch {
    hasGitBinary = false
  }

  return hasGitBinary
}

function getGitLastUpdated(fullPath: string): string | null {
  if (!canUseGit()) return null

  try {
    const lastUpdated = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', fullPath],
      { encoding: 'utf8' }
    ).trim()
    return lastUpdated || null
  } catch {
    return null
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addTitleToContent(content: string, title: string): string {
  const trimmedContent = content.trim()
  const titleRegex = new RegExp(`^#{1,6}\\s+${escapeRegex(title)}$`, 'im')
  const hasTitleHeading = titleRegex.test(trimmedContent)
  const firstLine = trimmedContent.split('\n')[0]
  const firstLineIsHeading = /^#{1,6}\s+/.test(firstLine)

  if (!hasTitleHeading && !firstLineIsHeading && title) {
    return `# ${title}\n\n${content}`
  }
  return content
}

function getExternalUrl(slug: string): string | null {
  const getRuntimeEnv = (key: string): string | undefined => {
    if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
      const value = window.__RUNTIME_CONFIG__[key]
      if (typeof value !== 'undefined') return value
    }
    return process.env[key]
  }

  const urlMap: Record<string, string> = {
    imprint: getRuntimeEnv('NEXT_PUBLIC_IMPRINT_URL') || '',
    terms: getRuntimeEnv('NEXT_PUBLIC_TC_URL') || '',
    'privacy-policy': getRuntimeEnv('NEXT_PUBLIC_PP_URL') || '',
    'cookie-policy': getRuntimeEnv('NEXT_PUBLIC_CP_URL') || '',
    'data-portal-usage-agreement': getRuntimeEnv('NEXT_PUBLIC_DPUA_URL') || ''
  }

  const url = urlMap[slug]
  return url && url.trim() !== '' ? url : null
}

async function fetchExternalContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,text/plain,text/markdown,application/json,*/*'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } catch (error) {
    console.error(`Error fetching external content from ${url}:`, error)
    return null
  }
}

function extractGitHubContent(html: string): string | null {
  const markdownMatch = html.match(
    /<article[^>]*class="markdown-body[^>]*>([\s\S]*?)<\/article>/i
  )
  if (markdownMatch && markdownMatch[1]) {
    let content = markdownMatch[1]
    content = content.replace(/<table>[\s\S]*?<\/table>/gi, '')
    content = content.replace(/<[^>]*>/g, '')
    return content.trim()
  }
  return null
}

function findMarkdownFile(slug: string, subDir?: string): string | null {
  const possiblePaths = []

  if (subDir) {
    possiblePaths.push(
      join(pagesDirectory, subDir, slug, 'en.md'),
      join(pagesDirectory, subDir, slug, 'index.md'),
      join(pagesDirectory, subDir, `${slug}.md`)
    )
  } else {
    possiblePaths.push(
      join(pagesDirectory, slug, 'en.md'),
      join(pagesDirectory, slug, 'index.md'),
      join(pagesDirectory, `${slug}.md`)
    )
  }

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path
    }
  }

  return null
}

export async function getPageBySlug(
  slug: string,
  subDir?: string
): Promise<PageData> {
  const realSlug = slug.replace(/\.md$/, '')

  const externalUrl = getExternalUrl(realSlug)

  if (externalUrl) {
    let externalContent = await fetchExternalContent(externalUrl)

    if (externalContent) {
      if (
        externalUrl.includes('github.com') &&
        externalUrl.includes('/blob/')
      ) {
        const extracted = extractGitHubContent(externalContent)
        if (extracted) externalContent = extracted
      }

      const { data, content } = matter(externalContent)

      const title =
        data.title ||
        realSlug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

      const contentWithTitle = addTitleToContent(content, title)

      return {
        slug: realSlug,
        frontmatter: data || { title },
        content: contentWithTitle,
        fileLastUpdated: new Date().toISOString().split('T')[0]
      }
    }
  }

  const filePath = findMarkdownFile(realSlug, subDir)

  if (!filePath) {
    throw new Error(`Page not found for slug: ${slug} in ${subDir || 'root'}`)
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  const fileStats = fs.statSync(filePath)
  const gitLastUpdated = getGitLastUpdated(filePath)
  const { data, content } = matter(fileContents)

  const title =
    data.title ||
    realSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const contentWithTitle = addTitleToContent(content, title)

  return {
    slug: realSlug,
    frontmatter: { ...data, title },
    content: contentWithTitle,
    fileLastUpdated: gitLastUpdated || fileStats.mtime.toISOString()
  }
}

export function getAllPages(subDir?: string): PageData[] {
  const targetDir = join(pagesDirectory, subDir || '')

  if (!fs.existsSync(targetDir)) {
    return []
  }

  const items = fs.readdirSync(targetDir)
  const pages: PageData[] = []

  for (const item of items) {
    const itemPath = join(targetDir, item)
    const stat = fs.statSync(itemPath)

    if (stat.isDirectory()) {
      const enMdPath = join(itemPath, 'en.md')
      const indexMdPath = join(itemPath, 'index.md')

      if (fs.existsSync(enMdPath)) {
        const fileContents = fs.readFileSync(enMdPath, 'utf8')
        const fileStats = fs.statSync(enMdPath)
        const gitLastUpdated = getGitLastUpdated(enMdPath)
        const { data, content } = matter(fileContents)

        const title =
          data.title ||
          item
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')

        const contentWithTitle = addTitleToContent(content, title)

        pages.push({
          slug: item,
          frontmatter: { ...data, title },
          content: contentWithTitle,
          fileLastUpdated: gitLastUpdated || fileStats.mtime.toISOString()
        })
      } else if (fs.existsSync(indexMdPath)) {
        const fileContents = fs.readFileSync(indexMdPath, 'utf8')
        const fileStats = fs.statSync(indexMdPath)
        const gitLastUpdated = getGitLastUpdated(indexMdPath)
        const { data, content } = matter(fileContents)

        const title =
          data.title ||
          item
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')

        const contentWithTitle = addTitleToContent(content, title)

        pages.push({
          slug: item,
          frontmatter: { ...data, title },
          content: contentWithTitle,
          fileLastUpdated: gitLastUpdated || fileStats.mtime.toISOString()
        })
      }
    } else if (item.endsWith('.md') && !item.startsWith('_')) {
      const slug = item.replace(/\.md$/, '')
      const filePath = join(targetDir, item)
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const fileStats = fs.statSync(filePath)
      const gitLastUpdated = getGitLastUpdated(filePath)
      const { data, content } = matter(fileContents)

      const title =
        data.title ||
        slug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')

      const contentWithTitle = addTitleToContent(content, title)

      pages.push({
        slug,
        frontmatter: { ...data, title },
        content: contentWithTitle,
        fileLastUpdated: gitLastUpdated || fileStats.mtime.toISOString()
      })
    }
  }

  return pages
}
