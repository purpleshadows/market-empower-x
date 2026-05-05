import type { NextApiRequest, NextApiResponse } from 'next'
import { clearAuthCookies } from './_cookies'
import { getSidFromIdToken } from './_oidc'
import { isSessionBlacklisted } from './_session-blacklist'

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

  const refreshToken = req.cookies.refresh_token
  const idToken = req.cookies.id_token

  if (!refreshToken) {
    return res.status(401).json({ error: 'No session' })
  }

  if (idToken) {
    const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
    const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
    if (issuer && clientId) {
      try {
        const sid = await getSidFromIdToken(idToken, issuer, clientId)
        if (sid && isSessionBlacklisted(sid)) {
          clearAuthCookies(res)
          return res.status(401).json({ error: 'Session terminated' })
        }
      } catch {
        // idToken verification failure — let /api/auth/refresh handle it
      }
    }
  }

  return res.status(200).json({ ok: true })
}
