/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { clearAuthCookies } from './_cookies'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'

function isAllowedOrigin(origin: string | undefined) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return true

  try {
    return origin === new URL(appUrl).origin
  } catch {
    return origin === appUrl.replace(/\/$/, '')
  }
}

function getEndSessionUrl(issuer: string) {
  return `${issuer.replace(/\/$/, '')}/end-session/`
}

function getRevokeUrl(issuer: string) {
  if (issuer.includes('/application/o/')) {
    const base = issuer.split('/application/o/')[0]
    return `${base}/application/o/revoke/`
  }
  return `${issuer.replace(/\/$/, '')}/revoke/`
}

async function revokeToken(
  revokeUrl: string,
  clientId: string,
  clientSecret: string,
  token: string,
  tokenTypeHint: string
): Promise<void> {
  try {
    await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokenTypeHint
      }),
      signal: AbortSignal.timeout(5000)
    })
  } catch (err) {
    console.error(`Token revocation failed (${tokenTypeHint}):`, err)
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }

  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
  const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]
  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER

  if (!clientId || !clientSecret || !issuer) {
    console.error('Missing OIDC configuration for logout')
    clearAuthCookies(res)
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const { access_token, refresh_token, id_token } = req.cookies
  const { state, post_logout_redirect_uri, revoke_only } = req.body

  const revokeUrl = getRevokeUrl(issuer)

  await Promise.all([
    access_token
      ? revokeToken(
          revokeUrl,
          clientId,
          clientSecret,
          access_token,
          'access_token'
        )
      : Promise.resolve(),
    refresh_token
      ? revokeToken(
          revokeUrl,
          clientId,
          clientSecret,
          refresh_token,
          'refresh_token'
        )
      : Promise.resolve()
  ])

  const params = new URLSearchParams({ client_id: clientId })

  if (id_token) params.set('id_token_hint', id_token)
  if (post_logout_redirect_uri)
    params.set('post_logout_redirect_uri', post_logout_redirect_uri)
  if (state) params.set('state', state)

  const logoutUrl = `${getEndSessionUrl(issuer)}?${params.toString()}`

  if (revoke_only) {
    return res.status(200).json({ logoutUrl })
  }

  clearAuthCookies(res)

  return res.status(200).json({ logoutUrl })
}
