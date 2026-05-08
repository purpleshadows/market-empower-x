/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { clearAuthCookies } from '../_cookies'

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

function isFederatedSource(loginSource: string): boolean {
  const raw = process.env.NEXT_PUBLIC_FEDERATED_OIDC_ISSUERS
  if (!raw) return false
  try {
    const issuers = JSON.parse(raw)
    if (!Array.isArray(issuers)) return false
    return issuers.some(
      (issuer: unknown) =>
        typeof issuer === 'string' &&
        loginSource.toLowerCase().includes(issuer.toLowerCase())
    )
  } catch {
    return false
  }
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

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
  const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]
  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER

  if (!clientId || !clientSecret || !issuer) {
    console.error('Missing OIDC configuration for logout')
    clearAuthCookies(res)
    return res.redirect(302, '/auth/login')
  }

  const { access_token, refresh_token, id_token, login_source } = req.cookies
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`
  // Use /auth/callback/logout as the VM2 end-session return URL — this page is
  // registered in the OIDC provider and handles the final redirect to market login.
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/auth/callback/logout`

  const vm2Params = new URLSearchParams({ client_id: clientId })
  if (id_token) vm2Params.set('id_token_hint', id_token)
  vm2Params.set('post_logout_redirect_uri', callbackUrl)
  const vm2EndSessionUrl = `${getEndSessionUrl(issuer)}?${vm2Params.toString()}`

  const federationEndSessionUrl = process.env.OIDC_FEDERATION_END_SESSION_URL
  const isFederatedLogin = Boolean(
    login_source && federationEndSessionUrl && isFederatedSource(login_source)
  )

  const redirectUrl = isFederatedLogin
    ? `${federationEndSessionUrl}?${new URLSearchParams({
        post_logout_redirect_uri: vm2EndSessionUrl
      }).toString()}`
    : vm2EndSessionUrl

  clearAuthCookies(res)
  return res.redirect(302, redirectUrl)
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
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

  const { access_token, refresh_token, id_token, login_source } = req.cookies
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

  const vm2Params = new URLSearchParams({ client_id: clientId })
  if (id_token) vm2Params.set('id_token_hint', id_token)
  if (post_logout_redirect_uri)
    vm2Params.set('post_logout_redirect_uri', post_logout_redirect_uri)
  if (state) vm2Params.set('state', state)
  const vm2LogoutUrl = `${getEndSessionUrl(issuer)}?${vm2Params.toString()}`

  const federationEndSessionUrl = process.env.OIDC_FEDERATION_END_SESSION_URL
  const isFederatedLogin = Boolean(
    login_source && federationEndSessionUrl && isFederatedSource(login_source)
  )

  const logoutUrl =
    isFederatedLogin && post_logout_redirect_uri
      ? `${federationEndSessionUrl}?${new URLSearchParams({
          post_logout_redirect_uri: vm2LogoutUrl
        }).toString()}`
      : vm2LogoutUrl

  if (revoke_only) {
    return res.status(200).json({ logoutUrl })
  }

  clearAuthCookies(res)
  return res.status(200).json({ logoutUrl })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }

  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
