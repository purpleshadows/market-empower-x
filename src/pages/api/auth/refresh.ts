import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSideOidcConfig } from '../../../config/auth.config'

export const config = {
  api: {
    bodyParser: true
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🔵 Refresh API called with method:', req.method)

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    console.log('🔴 Method not allowed:', req.method)
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST', 'OPTIONS']
    })
  }

  try {
    const { refresh_token: refreshToken } = req.body

    console.log('🔵 Refresh token request received:', !!refreshToken)

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      })
    }

    const oidcConfig = getServerSideOidcConfig()

    console.log('🔵 OIDC Config for refresh:', {
      issuer: oidcConfig.issuer,
      clientId: oidcConfig.clientId,
      hasSecret: !!oidcConfig.clientSecret
    })

    const tokenUrl = `${oidcConfig.issuer.replace(/\/$/, '')}/token/`
    console.log('🔵 Token URL:', tokenUrl)

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
        refresh_token: refreshToken
      })
    })

    const data = await response.json()
    console.log('🔵 Refresh response status:', response.status)

    if (!response.ok) {
      console.error('❌ Refresh failed:', data)
    } else {
      console.log('✅ Refresh successful')
    }

    return res.status(response.status).json(data)
  } catch (error) {
    console.error('❌ Refresh error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
