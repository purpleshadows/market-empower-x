/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAccessTokenMaxAge, setAuthCookies } from './_cookies'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'

function decodeJwtPayload(idToken: string) {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Missing id_token payload')

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '='
  )
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
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

    const { code, redirect_uri, code_verifier } = req.body

    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['code', 'redirect_uri', 'code_verifier']
      })
    }

    const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
    const clientSecret = process.env[OIDC_CLIENT_SECRET_ENV_KEY]
    let tokenUrl = process.env.NEXT_PUBLIC_OIDC_TOKEN_URL
    const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER

    if (!tokenUrl && issuer) {
      if (issuer.includes('/application/o/')) {
        const baseUrl = issuer.split('/application/o/')[0]
        tokenUrl = `${baseUrl}/application/o/token/`
      } else {
        tokenUrl = `${issuer.replace(/\/$/, '')}/token/`
      }
    }

    if (!clientId || !clientSecret || !tokenUrl) {
      console.error('Missing OIDC configuration', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasTokenUrl: !!tokenUrl
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

    const payload = decodeJwtPayload(data.id_token)
    const authMeta = {
      main_oidc: payload.iss,
      upstream_idp:
        payload.upstream_idp ||
        payload.last_idp ||
        payload.idp ||
        payload.source ||
        payload.provider ||
        payload.amr?.[0] ||
        'unknown'
    }

    setAuthCookies(res, data)

    return res.status(200).json({
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        username: payload.preferred_username || payload.username
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
