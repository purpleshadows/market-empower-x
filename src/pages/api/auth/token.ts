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
  // Log EVERYTHING for debugging
  console.log('🔵 Token API called with:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  })

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🟡 Handling OPTIONS preflight')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).end()
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log(`🔴 Method not allowed: ${req.method}`)
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['POST', 'OPTIONS'],
      receivedMethod: req.method
    })
  }

  try {
    const {
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    } = req.body

    console.log('🔵 Token request received:', {
      hasCode: !!code,
      hasRedirectUri: !!redirectUri,
      hasCodeVerifier: !!codeVerifier,
      codePreview: code?.substring(0, 20)
    })

    if (!code || !redirectUri || !codeVerifier) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['code', 'redirect_uri', 'code_verifier'],
        received: {
          code: !!code,
          redirect_uri: !!redirectUri,
          code_verifier: !!codeVerifier
        }
      })
    }

    const oidcConfig = getServerSideOidcConfig()

    console.log('🔵 OIDC Config:', {
      issuer: oidcConfig.issuer,
      clientId: oidcConfig.clientId,
      hasSecret: !!oidcConfig.clientSecret,
      secretLength: oidcConfig.clientSecret?.length
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
    console.log('🔵 Request params:', {
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      hasSecret: true,
      hasCode: !!code,
      redirect_uri: redirectUri,
      hasCodeVerifier: !!codeVerifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const text = await response.text()
    console.log('🔵 Authentik response status:', response.status)
    console.log('🔵 Authentik response headers:', response.headers)
    console.log('🔵 Authentik response body:', text.substring(0, 500))

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
      message: error.message,
      stack: error.stack
    })
  }
}
