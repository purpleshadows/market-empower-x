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
  const { code, redirect_uri, code_verifier } = req.body

  // eslint-disable-next-line camelcase
  if (!code || !redirect_uri || !code_verifier) {
    return res.status(400).json({ error: 'Missing required parameters' })
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
        grant_type: 'authorization_code',
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret || '',
        code,
        // eslint-disable-next-line camelcase
        redirect_uri,
        // eslint-disable-next-line camelcase
        code_verifier
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token exchange failed:', errorText)
      return res
        .status(response.status)
        .json({ error: 'Token exchange failed' })
    }

    const tokens = await response.json()
    res.status(200).json(tokens)
  } catch (error) {
    console.error('Token exchange error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
