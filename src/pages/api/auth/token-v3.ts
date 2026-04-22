/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'

// Cache the OpenID config
let cachedConfig: any = null
let lastFetch = 0
const CACHE_TTL = 3600000 // 1 hour

async function getOpenIDConfig() {
  // Return cached config if still valid
  if (cachedConfig && Date.now() - lastFetch < CACHE_TTL) {
    return cachedConfig
  }

  const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
  const configUrl = `${issuer}/.well-known/openid-configuration`

  console.log('Fetching OpenID config from:', configUrl)

  const response = await fetch(configUrl)
  const config = await response.json()

  cachedConfig = config
  lastFetch = Date.now()

  console.log('Token endpoint from config:', config.token_endpoint)

  return config
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST method' })
  }

  try {
    const { code, redirect_uri, code_verifier } = req.body

    // Get the correct token endpoint from OpenID config
    const openIdConfig = await getOpenIDConfig()
    const tokenUrl = openIdConfig.token_endpoint

    console.log('Using token URL:', tokenUrl)

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID!,
      client_secret: process.env.NEXT_PUBLIC_OIDC_CLIENT_SECRET!,
      code,
      redirect_uri,
      code_verifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
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
