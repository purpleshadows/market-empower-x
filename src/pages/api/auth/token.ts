/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('=== TOKEN ENDPOINT HIT ===')
  console.log('Method:', req.method)

  // For testing - respond to GET requests to verify endpoint exists
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Token endpoint is reachable. Use POST method.',
      status: 'alive'
    })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported. Use POST.`,
      allowedMethods: ['POST']
    })
  }

  try {
    const { getServerSideOidcConfig } = await import(
      '../../../config/auth.config'
    )

    const { code, redirect_uri, code_verifier } = req.body

    console.log('Request body:', {
      hasCode: !!code,
      hasRedirectUri: !!redirect_uri,
      hasCodeVerifier: !!code_verifier
    })

    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({
        error: 'Missing parameters',
        received: {
          code: !!code,
          redirect_uri: !!redirect_uri,
          code_verifier: !!code_verifier
        }
      })
    }

    const oidcConfig = getServerSideOidcConfig()
    const tokenUrl = oidcConfig.issuer.replace(/\/$/, '') + '/token/'

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: oidcConfig.clientId,
      client_secret: oidcConfig.clientSecret,
      code,
      redirect_uri,
      code_verifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Authentik error:', data)
      return res.status(response.status).json(data)
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Token error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
}
