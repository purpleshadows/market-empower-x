/* eslint-disable camelcase */
import crypto from 'crypto'
import type { NextApiResponse } from 'next'

const TRANSIENT_MAX_AGE = 600

const TRANSIENT_NAMES = [
  'oidc_pkce_verifier',
  'oidc_state',
  'oidc_nonce',
  'oidc_callback_url'
] as const

type TransientName = (typeof TRANSIENT_NAMES)[number]
type TransientValues = Partial<Record<TransientName, string>>

function serialize(
  name: TransientName,
  value: string,
  maxAge: number = TRANSIENT_MAX_AGE
): string {
  return `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth`
}

export function buildTransientCookieStrings(values: TransientValues): string[] {
  return (Object.entries(values) as [TransientName, string | undefined][])
    .filter((entry): entry is [TransientName, string] => entry[1] !== undefined)
    .map(([name, value]) => serialize(name, value))
}

export function buildClearTransientCookieStrings(): string[] {
  return TRANSIENT_NAMES.map((name) => serialize(name, '', 0))
}

export function setTransientCookies(
  res: NextApiResponse,
  values: TransientValues
) {
  const strings = buildTransientCookieStrings(values)
  if (strings.length > 0) res.setHeader('Set-Cookie', strings)
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function generateRandomString(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function isSafeCallbackUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('/') && !url.startsWith('//')) return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return false
  try {
    return new URL(url).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}
