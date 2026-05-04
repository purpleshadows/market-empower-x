/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { getAccessTokenMaxAge, setAuthCookies } from './_cookies'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'
const oidcMetadataCache = new Map<
  string,
  {
    issuer: string
    jwks: ReturnType<typeof createRemoteJWKSet>
  }
>()

async function getOidcMetadata(issuer: string) {
  const normalizedIssuer = issuer.replace(/\/$/, '')
  const cached = oidcMetadataCache.get(normalizedIssuer)
  if (cached) return cached

  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`
  const response = await fetch(discoveryUrl, {
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error('Unable to load OIDC discovery document')
  }

  const discovery = await response.json()
  if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery document missing jwks_uri')
  }

  const metadata = {
    issuer: typeof discovery.issuer === 'string' ? discovery.issuer : issuer,
    jwks: createRemoteJWKSet(new URL(discovery.jwks_uri))
  }
  oidcMetadataCache.set(normalizedIssuer, metadata)
  return metadata
}

async function verifyIdToken(
  idToken: string,
  issuer: string,
  clientId: string
) {
  const metadata = await getOidcMetadata(issuer)
  const { payload } = await jwtVerify(idToken, metadata.jwks, {
    issuer: metadata.issuer,
    audience: clientId
  })

  return payload
}

function getRequiredStringClaim(payload: JWTPayload, claim: string) {
  const value = payload[claim]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`id_token missing required claim: ${claim}`)
  }

  return value
}

function getOptionalStringClaim(payload: JWTPayload, claim: string) {
  const value = payload[claim]
  return typeof value === 'string' ? value : undefined
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    })
  }

  try {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
      return res.status(404).json({
        error: 'Not found'
      })
    }

    const { code, redirect_uri, code_verifier, nonce } = req.body

    if (
      !isNonEmptyString(code) ||
      !isNonEmptyString(redirect_uri) ||
      !isNonEmptyString(code_verifier) ||
      !isNonEmptyString(nonce)
    ) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['code', 'redirect_uri', 'code_verifier', 'nonce']
      })
    }

    const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
    const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]
    let tokenUrl = process.env.NEXT_PUBLIC_OIDC_TOKEN_URL
    const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
    const configuredRedirectUri = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI

    if (!configuredRedirectUri || redirect_uri !== configuredRedirectUri) {
      return res.status(400).json({
        error: 'Invalid redirect_uri'
      })
    }

    if (!tokenUrl && issuer) {
      if (issuer.includes('/application/o/')) {
        const baseUrl = issuer.split('/application/o/')[0]
        tokenUrl = `${baseUrl}/application/o/token/`
      } else {
        tokenUrl = `${issuer.replace(/\/$/, '')}/token/`
      }
    }

    if (!clientId || !clientSecret || !tokenUrl || !issuer) {
      console.error('Missing OIDC configuration', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasTokenUrl: !!tokenUrl,
        hasIssuer: !!issuer
      })
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'OIDC credentials or token URL not configured'
      })
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri,
      code_verifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params,
      signal: AbortSignal.timeout(10000)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Authentik token error:', {
        status: response.status,
        error: data.error,
        description: data.error_description
      })
      return res.status(response.status).json(data)
    }

    const payload = await verifyIdToken(data.id_token, issuer, clientId)
    if (payload.nonce !== nonce) {
      return res.status(401).json({
        error: 'Invalid nonce'
      })
    }

    const userId = getRequiredStringClaim(payload, 'sub')
    const email = getRequiredStringClaim(payload, 'email')
    const name = getRequiredStringClaim(payload, 'name')
    const username =
      getOptionalStringClaim(payload, 'preferred_username') ||
      getOptionalStringClaim(payload, 'username')
    const authMeta = {
      main_oidc: getRequiredStringClaim(payload, 'iss'),
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

    setAuthCookies(res, data)

    return res.status(200).json({
      user: {
        id: userId,
        email,
        name,
        username
      },
      authMeta,
      expires_in: getAccessTokenMaxAge(data)
    })
  } catch (error) {
    console.error('Token exchange error:', error)

    if (error.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Authentication server did not respond in time'
      })
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
