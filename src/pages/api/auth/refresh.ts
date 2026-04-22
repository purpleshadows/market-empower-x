import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSideOidcConfig } from '../../../config/auth.config'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // eslint-disable-next-line camelcase
  const { refresh_token } = req.body

  // eslint-disable-next-line camelcase
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token required' })
  }

  try {
    const oidcConfig = getServerSideOidcConfig()

    const tokenUrl = `${oidcConfig.issuer.replace(/\/$/, '')}/token/`

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret || '',
        // eslint-disable-next-line camelcase
        refresh_token
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token refresh failed:', errorText)
      return res.status(response.status).json({ error: 'Token refresh failed' })
    }

    const tokens = await response.json()
    res.status(200).json(tokens)
  } catch (error) {
    console.error('Token refresh error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
