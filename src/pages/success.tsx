import { ReactElement } from 'react'
import Page from '@shared/Page'
import Head from 'next/head'
import Button from '@shared/atoms/Button'
import { useRouter } from 'next/router'

// Landing page for a successful SSI credential presentation. The policy server
// (WALTID_SUCCESS_REDIRECT_URL) redirects the wallet/browser here after the
// verifier accepts the presentation. The marketplace detects completion via its
// own polling, so this page is a friendly confirmation for the cross-device
// wallet flow. The `id` query param carries the verification session id.
export default function VerificationSuccess(): ReactElement {
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
        title="Verification Successful"
        description="Your credential was verified. You can return to the marketplace to continue with your download."
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
