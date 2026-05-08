/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { buildClearAuthCookieStrings, clearAuthCookies } from '../_cookies'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'
const FEDERATED_LOGOUT_CONTINUE_COOKIE = 'federated_logout_continue'

function getHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function getRequestOrigin(req: NextApiRequest): string {
  const host = getHeaderValue(req.headers.host)
  const forwardedProto = getHeaderValue(req.headers['x-forwarded-proto'])
  const protocol = forwardedProto.split(',')[0]?.trim() || 'https'

  return `${protocol}://${host}`
}

function isAllowedOrigin(req: NextApiRequest) {
  const { origin } = req.headers
  if (!origin) return true

  return origin === getRequestOrigin(req)
}

function getEndSessionUrl(issuer: string) {
  return `${issuer.replace(/\/$/, '')}/end-session/`
}

function serializeFederatedLogoutContinueCookie(value: string, maxAge: number) {
  return `${FEDERATED_LOGOUT_CONTINUE_COOKIE}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/logout`
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

  const {
    access_token,
    refresh_token,
    id_token,
    logout_id_token,
    login_source
  } = req.cookies
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

  // Use /auth/callback/logout as the VM2 end-session return URL — this page is
  // registered in the OIDC provider and handles the final redirect to market login.
  const callbackUrl = `${getRequestOrigin(req)}/auth/callback/logout`

  const vm2Params = new URLSearchParams({ client_id: clientId })
  if (id_token || logout_id_token)
    vm2Params.set('id_token_hint', id_token || logout_id_token)
  vm2Params.set('post_logout_redirect_uri', callbackUrl)
  vm2Params.set('state', 'logout')
  const vm2EndSessionUrl = `${getEndSessionUrl(issuer)}?${vm2Params.toString()}`

  const federationEndSessionUrl = process.env.OIDC_FEDERATION_END_SESSION_URL
  const isFederatedLogin = Boolean(
    login_source && federationEndSessionUrl && isFederatedSource(login_source)
  )

  if (isFederatedLogin) {
    res.setHeader('Set-Cookie', [
      ...buildClearAuthCookieStrings({ keepLogoutIdToken: true }),
      serializeFederatedLogoutContinueCookie('1', 300)
    ])

    const redirectUrl = `${federationEndSessionUrl}?${new URLSearchParams({
      post_logout_redirect_uri: callbackUrl
    }).toString()}`
    return res.redirect(302, redirectUrl)
  }

  clearAuthCookies(res)
  return res.redirect(302, vm2EndSessionUrl)
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  if (!isAllowedOrigin(req)) {
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
