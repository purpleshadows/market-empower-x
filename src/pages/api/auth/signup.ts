/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { isSafeCallbackUrl } from './_transient'
import {
  authEnabled,
  oidcClientId,
  oidcIssuer,
  oidcRedirectUri,
  oidcSignupFlow
} from 'app.config.cjs'

function getSignupUrl(
  issuer: string,
  signupFlow: string,
  authorizeUrl: string
): string {
  const authentikBase = issuer.replace(/\/application\/o\/.*$/, '')
  return `${authentikBase}/if/flow/${signupFlow}/?next=${encodeURIComponent(
    authorizeUrl
  )}`
}

function buildPostSignupUrl(redirectUri: string, callbackUrl: string | null) {
  const url = new URL('/api/auth/login', redirectUri)
  if (callbackUrl) url.searchParams.set('callbackUrl', callbackUrl)
  return url.toString()
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end()
  }

  if (authEnabled !== 'true') {
    return res.status(404).end()
  }

  const issuer = oidcIssuer
  const clientId = oidcClientId
  const redirectUri = oidcRedirectUri
  const signupFlow = oidcSignupFlow || 'self-service-registration'

  if (!issuer || !clientId || !redirectUri) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const rawCallbackUrl =
    typeof req.query.callbackUrl === 'string' ? req.query.callbackUrl : ''
  const callbackUrl = isSafeCallbackUrl(rawCallbackUrl) ? rawCallbackUrl : null

  return res.redirect(
    302,
    getSignupUrl(
      issuer,
      signupFlow,
      buildPostSignupUrl(redirectUri, callbackUrl)
    )
  )
}
