/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import {
  clearAuthCookies,
  getAccessTokenMaxAge,
  setAuthCookies
} from './_cookies'
import { OIDC_REQUEST_TIMEOUT_MS } from './_constants'
import { getSidFromIdToken } from './_oidc'
import { isSessionBlacklisted } from './_session-blacklist'

const OIDC_CLIENT_SECRET_ENV_KEY = 'OIDC_CLIENT_SECRET'

type TokenEndpointError = {
  error?: unknown
  error_description?: unknown
}

type TokenEndpointResponse = TokenEndpointError & {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
}

function isAllowedOrigin(origin: string | undefined) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return true

  try {
    return origin === new URL(appUrl).origin
  } catch {
    return origin === appUrl.replace(/\/$/, '')
  }
}

function getErrorCode(data: TokenEndpointError): string | undefined {
  return typeof data.error === 'string' ? data.error : undefined
}

function getErrorDescription(data: TokenEndpointError): string | undefined {
  return typeof data.error_description === 'string'
    ? data.error_description
    : undefined
}

function isDefinitiveRefreshFailure(
  status: number,
  data: TokenEndpointError
): boolean {
  return (
    status === 401 ||
    status === 403 ||
    (status === 400 && getErrorCode(data) === 'invalid_grant')
  )
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
      clearAuthCookies(res)
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
      signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
    })

    const data = (await response
      .json()
      .catch(() => ({}))) as TokenEndpointResponse

    if (!response.ok) {
      console.error('Token refresh error:', {
        status: response.status,
        error: getErrorCode(data),
        description: getErrorDescription(data)
      })

      if (isDefinitiveRefreshFailure(response.status, data)) {
        clearAuthCookies(res)
        return res.status(401).json({
          error: getErrorCode(data) || 'invalid_grant',
          message:
            getErrorDescription(data) ||
            'Refresh token is invalid or no longer accepted'
        })
      }

      return res.status(response.status).json({
        error: getErrorCode(data) || 'refresh_unavailable',
        message:
          getErrorDescription(data) ||
          'Authentication server is temporarily unavailable'
      })
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
