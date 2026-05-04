/* eslint-disable camelcase */
import type { NextApiResponse } from 'next'

const AUTH_COOKIE_NAMES = ['access_token', 'refresh_token', 'id_token'] as const
export const DEFAULT_ACCESS_TOKEN_MAX_AGE = 3600
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60

type AuthCookieName = (typeof AUTH_COOKIE_NAMES)[number]

type AuthTokens = Partial<Record<AuthCookieName, string>> & {
  expires_in?: number
}

export function getAccessTokenMaxAge(tokens: AuthTokens) {
  return typeof tokens.expires_in === 'number' && tokens.expires_in > 0
    ? tokens.expires_in
    : DEFAULT_ACCESS_TOKEN_MAX_AGE
}

function serializeCookie(name: AuthCookieName, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict; Path=/`
}

export function setAuthCookies(res: NextApiResponse, tokens: AuthTokens) {
  const accessTokenMaxAge = getAccessTokenMaxAge(tokens)

  const cookies = [
    tokens.access_token &&
      serializeCookie('access_token', tokens.access_token, accessTokenMaxAge),
    tokens.refresh_token &&
      serializeCookie(
        'refresh_token',
        tokens.refresh_token,
        REFRESH_TOKEN_MAX_AGE
      ),
    tokens.id_token &&
      serializeCookie('id_token', tokens.id_token, accessTokenMaxAge)
  ].filter(Boolean) as string[]

  if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
}

export function clearAuthCookies(res: NextApiResponse) {
  res.setHeader(
    'Set-Cookie',
    AUTH_COOKIE_NAMES.map((name) => serializeCookie(name, '', 0))
  )
}
