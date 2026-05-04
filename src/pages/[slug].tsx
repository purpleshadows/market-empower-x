import { ReactElement } from 'react'
import { getPageBySlug, getAllPages, PageData } from '@utils/markdownPages'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import Time from '@shared/atoms/Time'
import { useRouter } from 'next/router'
import { markdownToHtmlWithToc } from '@utils/markdown'

export default function PageMarkdown(page: PageData): ReactElement {
  const router = useRouter()
  if (!page || page.content === '') return null

  const { title, description, showLastUpdated, lastUpdated } = page.frontmatter
  const { content, fileLastUpdated } = page
  const resolvedLastUpdated = lastUpdated || fileLastUpdated

  return (
    <Page
      title={title}
      description={description}
      uri={router.asPath}
      headerCenter
    >
      <Container narrow>
        <div className={styles.section}>
          <h2 className={styles.title}>{title}</h2>
          {showLastUpdated && (
            <p className={styles.lastUpdated}>
              <em>
                Last updated on{' '}
                <Time
                  date={resolvedLastUpdated}
                  displayFormat="MMMM dd, yyyy."
                />
              </em>
            </p>
          )}
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </Container>
    </Page>
  )
}

export async function getStaticProps({
  params
}: {
  params: { slug: string }
}): Promise<{ props: PageData; revalidate?: number }> {
  const page = await getPageBySlug(params.slug)
  const content = markdownToHtmlWithToc(page?.content || '')
  const hasExternalUrls = !!(
    process.env.NEXT_PUBLIC_IMPRINT_URL ||
    process.env.NEXT_PUBLIC_TC_URL ||
    process.env.NEXT_PUBLIC_PP_URL ||
    process.env.NEXT_PUBLIC_CP_URL ||
    process.env.NEXT_PUBLIC_DPUA_URL
  )

  return {
    props: { ...page, content },
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
  const pages = getAllPages()

  return {
    paths: pages.map((page) => {
      return {
        params: { slug: page.slug }
      }
    }),
    fallback: 'blocking'
  }
}
