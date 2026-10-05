import { ReactElement } from 'react'
import Page from '@shared/Page'
import Head from 'next/head'
import Button from '@shared/atoms/Button'
import { useRouter } from 'next/router'

// Landing page for a failed SSI credential presentation. The policy server
// (WALTID_ERROR_REDIRECT_URL) redirects the wallet/browser here when the
// verifier rejects the presentation (missing/invalid/expired credential). The
// `id` query param carries the verification session id.
export default function VerificationError(): ReactElement {
  const router = useRouter()

  return (
    <>
      <Head>
        <style type="text/css">{`
          main {
            text-align: center;
          }
        `}</style>
      </Head>
      <Page
        title="Verification Failed"
        description="Your credential could not be verified. Please make sure you hold a valid, unexpired credential and try again from the asset page."
        uri={router.route}
        headerCenter
      >
        <Button style="primary" to="/">
          Back to Marketplace
        </Button>
      </Page>
    </>
  )
}
