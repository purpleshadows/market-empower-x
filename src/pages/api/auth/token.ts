import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSideOidcConfig } from '../../../config/auth.config'

// Disable body parser for debugging if needed
export const config = {
  api: {
    bodyParser: true
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🔵 Token API called with method:', req.method)

  // Allow preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
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
    const {
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    } = req.body

    console.log('🔵 Token request received:', {
      code: code?.substring(0, 20) + '...',
      redirectUri,
      codeVerifier: codeVerifier?.substring(0, 20) + '...'
    })

    if (!code || !redirectUri || !codeVerifier) {
      return res.status(400).json({
        error: 'Missing required parameters',
        missing: {
          code: !code,
          redirectUri: !redirectUri,
          codeVerifier: !codeVerifier
        }
      })
    }

    const oidcConfig = getServerSideOidcConfig()

    console.log('🔵 OIDC Config:', {
      issuer: oidcConfig.issuer,
      clientId: oidcConfig.clientId,
      hasSecret: !!oidcConfig.clientSecret
    })

    if (!oidcConfig.clientSecret) {
      console.error('❌ Missing client secret on server')
      return res.status(500).json({
        error: 'Server misconfiguration: missing client secret'
      })
    }

    const tokenUrl = `${oidcConfig.issuer.replace(/\/$/, '')}/token/`
    console.log('🔵 Token URL:', tokenUrl)

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    console.log('🔵 Sending request to Authentik...')

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const text = await response.text()
    console.log('🔵 Authentik response status:', response.status)
    console.log('🔵 Authentik response body preview:', text.substring(0, 200))

    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    if (!response.ok) {
      console.error('❌ Authentik token error:', data)
      return res.status(response.status).json(data)
    }

    console.log('✅ Token exchange successful')
    return res.status(200).json(data)
  } catch (error) {
    console.error('❌ Token endpoint crash:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
