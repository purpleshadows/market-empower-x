/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify, type JWTPayload } from 'jose'
import { clearAuthCookies, DEFAULT_ACCESS_TOKEN_MAX_AGE } from './_cookies'
import { getOidcMetadata } from './_oidc'
import { isSessionBlacklisted } from './_session-blacklist'

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

  if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' })
  }

  const accessToken = req.cookies.access_token
  const refreshToken = req.cookies.refresh_token
  const idToken = req.cookies.id_token

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ error: 'No session' })
  }

  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
  const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID

  if (idToken && issuer && clientId) {
    try {
      const metadata = await getOidcMetadata(issuer)
      const { payload } = await jwtVerify(idToken, metadata.jwks, {
        issuer: metadata.issuer,
        audience: clientId
      })

      const sid = typeof payload.sid === 'string' ? payload.sid : undefined
      if (sid && isSessionBlacklisted(sid)) {
        clearAuthCookies(res)
        return res.status(401).json({ error: 'Session terminated' })
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
        expires_in: expiresIn
      })
    } catch {
      // id_token expired or invalid — session may still be refreshable
    }
  }

  return res.status(200).json({ ok: true })
}
