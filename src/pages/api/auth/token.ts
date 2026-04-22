import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSideOidcConfig } from '../../../config/auth.config'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Allow preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    } = req.body

    if (!code || !redirectUri || !codeVerifier) {
      return res.status(400).json({
        error: 'Missing required parameters'
      })
    }

    const oidcConfig = getServerSideOidcConfig()

    if (!oidcConfig.clientSecret) {
      console.error('❌ Missing client secret on server')
      return res.status(500).json({
        error: 'Server misconfiguration: missing client secret'
      })
    }

    const tokenUrl = `${oidcConfig.issuer.replace(/\/$/, '')}/token/`

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const text = await response.text()

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

    return res.status(200).json(data)
  } catch (error) {
    console.error('❌ Token endpoint crash:', error)
    return res.status(500).json({
      error: 'Internal server error'
    })
  }
}
