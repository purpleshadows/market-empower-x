/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify, type JWTPayload } from 'jose'
import { buildAuthCookieStrings } from './_cookies'
import { buildClearTransientCookieStrings } from './_transient'
import { getOidcMetadata } from './_oidc'
import { OIDC_REQUEST_TIMEOUT_MS } from './_constants'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'

function getTokenUrl(issuer: string): string {
  if (issuer.includes('/application/o/')) {
    const base = issuer.split('/application/o/')[0]
    return `${base}/application/o/token/`
  }
  return `${issuer.replace(/\/$/, '')}/token/`
}

function getRequiredStringClaim(payload: JWTPayload, claim: string): string {
  const value = payload[claim]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`id_token missing required claim: ${claim}`)
  }
  return value
}

function failRedirect(res: NextApiResponse, reason = 'auth_failed') {
  res.setHeader('Set-Cookie', buildClearTransientCookieStrings())
  return res.redirect(302, `/auth/login?error=${reason}`)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).end()
  }

  const { code, state, error } = req.query

  if (error) return failRedirect(res)

  if (typeof code !== 'string' || typeof state !== 'string') {
    return failRedirect(res)
  }

  const expectedState = req.cookies.oidc_state
  const codeVerifier = req.cookies.oidc_pkce_verifier
  const expectedNonce = req.cookies.oidc_nonce
  const callbackUrl = req.cookies.oidc_callback_url

  if (!expectedState || state !== expectedState) return failRedirect(res)
  if (!codeVerifier || !expectedNonce) return failRedirect(res)

  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
  const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]
  const redirectUri = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    return failRedirect(res, 'server_error')
  }

  try {
    const tokenUrl =
      process.env.NEXT_PUBLIC_OIDC_TOKEN_URL || getTokenUrl(issuer)

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }),
      signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
    })

    const data = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', {
        status: tokenRes.status,
        error: data.error
      })
      return failRedirect(res)
    }

    const metadata = await getOidcMetadata(issuer)
    const { payload } = await jwtVerify(data.id_token, metadata.jwks, {
      issuer: metadata.issuer,
      audience: clientId
    })

    if (payload.nonce !== expectedNonce) return failRedirect(res)

    // Validate required claims — throws if any are missing or empty
    getRequiredStringClaim(payload, 'sub')
    getRequiredStringClaim(payload, 'email')
    getRequiredStringClaim(payload, 'name')
    getRequiredStringClaim(payload, 'iss')

    const upstreamIdp =
      (typeof payload.upstream_idp === 'string' && payload.upstream_idp) ||
      (typeof payload.last_idp === 'string' && payload.last_idp) ||
      (typeof payload.idp === 'string' && payload.idp) ||
      undefined

    res.setHeader('Set-Cookie', [
      ...buildAuthCookieStrings(data, upstreamIdp),
      ...buildClearTransientCookieStrings()
    ])

    // Always return to /auth/login so the onboarding flow (wallet + SSI) can run.
    // The login page then redirects to callbackUrl when onboarding is complete.
    const qs = new URLSearchParams({ hydrated: '1' })
    if (callbackUrl) qs.set('callbackUrl', callbackUrl)
    return res.redirect(302, `/auth/login?${qs.toString()}`)
  } catch (err) {
    console.error('OIDC callback error:', err)
    return failRedirect(res)
  }
}
