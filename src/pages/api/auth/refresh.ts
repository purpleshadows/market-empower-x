/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify } from 'jose'
import {
  clearAuthCookies,
  getAccessTokenMaxAge,
  setAuthCookies
} from './_cookies'
import { getOidcMetadata } from './_oidc'
import { isSessionBlacklisted } from './_session-blacklist'

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

async function getSidFromIdToken(
  idToken: string,
  issuer: string,
  clientId: string
) {
  const metadata = await getOidcMetadata(issuer)
  const { payload } = await jwtVerify(idToken, metadata.jwks, {
    issuer: metadata.issuer,
    audience: clientId
  })

  return typeof payload.sid === 'string' && payload.sid.length > 0
    ? payload.sid
    : undefined
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

    if (!isAllowedOrigin(req.headers.origin)) {
      return res.status(403).json({
        error: 'Forbidden'
      })
    }

    const { refresh_token, id_token } = req.cookies
    if (!refresh_token) {
      return res.status(401).json({
        error: 'Refresh token required'
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
      console.error('Missing OIDC configuration')
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'OIDC credentials or token URL not configured'
      })
    }

    if (id_token && issuer) {
      try {
        const sid = await getSidFromIdToken(id_token, issuer, clientId)
        if (sid && isSessionBlacklisted(sid)) {
          clearAuthCookies(res)
          return res.status(401).json({
            error: 'Session has been terminated'
          })
        }
      } catch (error) {
        console.error('Unable to verify id_token for blacklist check:', error)
      }
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token
      }),
      signal: AbortSignal.timeout(10000)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Token refresh error:', {
        status: response.status,
        error: data.error,
        description: data.error_description
      })
      return res.status(response.status).json(data)
    }

    setAuthCookies(res, {
      ...data,
      id_token: data.id_token || id_token
    })

    return res.status(200).json({
      expires_in: getAccessTokenMaxAge(data)
    })
  } catch (error) {
    console.error('Refresh error:', error)

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
