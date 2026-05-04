import { ReactElement } from 'react'
import { markdownToHtmlWithToc } from '@utils/markdown'
import { getPageBySlug, getAllPages, PageData } from '@utils/markdownPages'
import { extractHeadingsFromMarkdown, Heading } from '@utils/extractHeadings'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import PrivacyPolicyHeader from '../../components/Privacy/PrivacyHeader'
import TableOfContents from '../../components/@shared/TableOfContents'
import StickySidebarLayout from '../../components/@shared/StickySidebarLayout'
import HashScrollHandler from '../../components/@shared/HashScrollHandler'
import { useRouter } from 'next/router'

interface PrivacyPageData extends PageData {
  headings: Heading[]
}

export default function PageMarkdown(page: PrivacyPageData): ReactElement {
  const router = useRouter()
  const { title, description } = page.frontmatter
  const { slug, content, headings, fileLastUpdated } = page

  if (!page || page.content === '') return null

  return (
    <Page
      title={title}
      description={description}
      uri={router.asPath}
      headerCenter
    >
      <Container>
        <HashScrollHandler />
        <PrivacyPolicyHeader
          policy={slug.replace('/privacy/', '')}
          lastUpdatedDate={fileLastUpdated}
        />
        {headings.length > 0 ? (
          <StickySidebarLayout
            sidebar={<TableOfContents headings={headings} />}
          >
            <div className={styles.section}>
              <div
                className={styles.content}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </StickySidebarLayout>
        ) : (
          <div className={styles.section}>
            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </Container>
    </Page>
  )
}

export async function getStaticProps({
  params
}: {
  params: { slug: string }
}): Promise<{ props: PrivacyPageData; revalidate?: number }> {
  const page = await getPageBySlug(params.slug, 'privacy')
  const content = markdownToHtmlWithToc(page?.content || '')
  const headings = extractHeadingsFromMarkdown(page?.content || '')

  const hasExternalUrls = !!(
    process.env.NEXT_PUBLIC_IMPRINT_URL ||
    process.env.NEXT_PUBLIC_TC_URL ||
    process.env.NEXT_PUBLIC_PP_URL ||
    process.env.NEXT_PUBLIC_CP_URL ||
    process.env.NEXT_PUBLIC_DPUA_URL
  )

  return {
    props: { ...page, content, headings },
    revalidate: hasExternalUrls ? 3600 : undefined
  }
}

export async function getStaticPaths(): Promise<{
  paths: {
    params: {
      slug: string
    }
  }[]
  fallback: boolean | 'blocking'
}> {
  const pages = getAllPages('privacy')

  return {
    paths: pages.map((page) => {
      return {
        params: { slug: page.slug }
      }
    }),
    fallback: 'blocking'
  }
}
