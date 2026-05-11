/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify, type JWTPayload } from 'jose'
import { DEFAULT_ACCESS_TOKEN_MAX_AGE } from './_cookies'
import { getOidcMetadata } from './_oidc'
import { introspectAccessToken } from './_introspect'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'

function getOptionalStringClaim(
  payload: JWTPayload,
  claim: string
): string | undefined {
  const value = payload[claim]
  return typeof value === 'string' ? value : undefined
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store')

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }

  const accessToken = req.cookies.access_token
  const refreshToken = req.cookies.refresh_token
  const idToken = req.cookies.id_token

  if (!accessToken && !refreshToken) {
    return res.status(401).json({
      error: 'No session',
      has_refresh_token: false
    })
  }

  // A refresh token alone is not enough to trust the session. Make the client
  // refresh so Authentik can reject revoked sessions with `invalid_grant`.
  if (!accessToken && refreshToken) {
    return res.status(401).json({
      error: 'Access token missing',
      has_refresh_token: true,
      refresh_required: true
    })
  }

  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
  const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]

  if (!issuer || !clientId || !clientSecret) {
    console.error('Missing OIDC configuration for session verification')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  if (!idToken) {
    return res.status(401).json({
      error: 'Session verification required',
      has_refresh_token: Boolean(refreshToken),
      refresh_required: Boolean(refreshToken)
    })
  }

  try {
    const metadata = await getOidcMetadata(issuer)
    const { payload } = await jwtVerify(idToken, metadata.jwks, {
      issuer: metadata.issuer,
      audience: clientId
    })

    // JWT verification only proves the token was issued by us. Introspection
    // is the live source of truth for revocations after token issuance.
    if (accessToken) {
      const introspection = await introspectAccessToken(
        accessToken,
        issuer,
        clientId,
        clientSecret
      )
      if (introspection.status === 'inactive') {
        return res.status(401).json({
          error: 'Session terminated',
          has_refresh_token: Boolean(refreshToken)
        })
      }

      if (introspection.status === 'unknown') {
        return res.status(503).json({
          error: 'Session status unavailable',
          has_refresh_token: Boolean(refreshToken)
        })
      }
    }

    const expiresIn = payload.exp
      ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
      : DEFAULT_ACCESS_TOKEN_MAX_AGE

    const authMeta = {
      main_oidc: getOptionalStringClaim(payload, 'iss') || issuer,
      upstream_idp:
        getOptionalStringClaim(payload, 'upstream_idp') ||
        getOptionalStringClaim(payload, 'last_idp') ||
        getOptionalStringClaim(payload, 'idp') ||
        getOptionalStringClaim(payload, 'source') ||
        getOptionalStringClaim(payload, 'provider') ||
        (Array.isArray(payload.amr) && typeof payload.amr[0] === 'string'
          ? payload.amr[0]
          : undefined) ||
        'unknown'
    }

    return res.status(200).json({
      user: {
        id: getOptionalStringClaim(payload, 'sub'),
        email: getOptionalStringClaim(payload, 'email'),
        name: getOptionalStringClaim(payload, 'name'),
        username:
          getOptionalStringClaim(payload, 'preferred_username') ||
          getOptionalStringClaim(payload, 'username')
      },
      authMeta,
      has_refresh_token: Boolean(refreshToken),
      expires_in: expiresIn
    })
  } catch (error) {
    console.error('Session id_token verification failed:', error)
    return res.status(401).json({
      error: 'Session verification failed',
      has_refresh_token: Boolean(refreshToken),
      refresh_required: Boolean(refreshToken)
    })
  }
}
