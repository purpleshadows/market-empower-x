/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { buildClearAuthCookieStrings } from '../_cookies'

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

function getEndSessionUrl(issuer: string) {
  return `${issuer.replace(/\/$/, '')}/end-session/`
}

function serializeFederatedLogoutContinueCookie(value: string, maxAge: number) {
  return `${FEDERATED_LOGOUT_CONTINUE_COOKIE}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/logout`
}

function clearLogoutCookies(res: NextApiResponse) {
  res.setHeader('Set-Cookie', [
    ...buildClearAuthCookieStrings(),
    serializeFederatedLogoutContinueCookie('', 0)
  ])
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).end()
  }

  if (req.cookies[FEDERATED_LOGOUT_CONTINUE_COOKIE] !== '1') {
    clearLogoutCookies(res)
    return res.redirect(302, '/auth/login?loggedout=1')
  }

  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER

  if (!clientId || !issuer) {
    console.error('Missing OIDC configuration for logout continuation')
    clearLogoutCookies(res)
    return res.redirect(302, '/auth/login?loggedout=1')
  }

  const callbackUrl = `${getRequestOrigin(req)}/auth/callback/logout`
  const vm2Params = new URLSearchParams({ client_id: clientId })
  const idTokenHint = req.cookies.logout_id_token || req.cookies.id_token

  if (idTokenHint) vm2Params.set('id_token_hint', idTokenHint)
  vm2Params.set('post_logout_redirect_uri', callbackUrl)

  clearLogoutCookies(res)
  return res.redirect(
    302,
    `${getEndSessionUrl(issuer)}?${vm2Params.toString()}`
  )
}
