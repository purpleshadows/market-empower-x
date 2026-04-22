/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('=== REFRESH TOKEN ENDPOINT HIT ===')
  console.log('Method:', req.method)

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST']
    })
  }

  try {
    const { getServerSideOidcConfig } = await import(
      '../../../config/auth.config'
    )
    const { refresh_token } = req.body

    console.log('Refresh token received:', !!refresh_token)

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Refresh token required'
      })
    }

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
        client_secret: oidcConfig.clientSecret,
        refresh_token
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Refresh failed:', data)
      return res.status(response.status).json(data)
    }

    console.log('Refresh successful')
    return res.status(200).json(data)
  } catch (error) {
    console.error('Refresh error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
