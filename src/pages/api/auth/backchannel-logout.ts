/* eslint-disable camelcase */
import type { NextApiRequest, NextApiResponse } from 'next'
import { jwtVerify, type JWTPayload } from 'jose'
import {
  BACKCHANNEL_LOGOUT_EVENT,
  JTI_TTL_MS,
  LOGOUT_TOKEN_MAX_AGE_SECONDS
} from './_constants'
import { DEFAULT_ACCESS_TOKEN_MAX_AGE } from './_cookies'
import { getOidcMetadata } from './_oidc'
import { blacklistSession, isJtiSeen, recordJti } from './_session-blacklist'

function getLogoutToken(body: unknown) {
  if (!body) return undefined

  if (typeof body === 'string') {
    const params = new URLSearchParams(body)
    const logoutToken = params.get('logout_token')
    return logoutToken || undefined
  }

  if (typeof body === 'object' && 'logout_token' in body) {
    const logoutToken = (body as { logout_token?: unknown }).logout_token
    return typeof logoutToken === 'string' && logoutToken.length > 0
      ? logoutToken
      : undefined
  }

  return undefined
}

function hasBackchannelLogoutEvent(payload: JWTPayload) {
  const { events } = payload
  return (
    typeof events === 'object' &&
    events !== null &&
    BACKCHANNEL_LOGOUT_EVENT in events
  )
}

function validateLogoutTokenPayload(payload: JWTPayload) {
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (
    typeof payload.iat !== 'number' ||
    payload.iat < nowSeconds - LOGOUT_TOKEN_MAX_AGE_SECONDS ||
    payload.iat > nowSeconds
  ) {
    throw new Error('logout_token iat is outside the allowed window')
  }

  if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
    throw new Error('logout_token missing jti')
  }

  if (isJtiSeen(payload.jti)) {
    throw new Error('logout_token replay detected')
  }
  recordJti(payload.jti, JTI_TTL_MS)

  if (!hasBackchannelLogoutEvent(payload)) {
    throw new Error('logout_token missing backchannel logout event')
  }

  if (payload.nonce !== undefined) {
    throw new Error('logout_token must not contain nonce')
  }

  if (typeof payload.sid !== 'string' || payload.sid.length === 0) {
    throw new Error('logout_token missing sid')
  }

  return payload.sid
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'true') {
      throw new Error('Authentication is disabled')
    }

    const logoutToken = getLogoutToken(req.body)
    if (!logoutToken) {
      throw new Error('Missing logout_token')
    }

    const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER
    const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID
    if (!issuer || !clientId) {
      throw new Error('Missing OIDC configuration')
    }

    const metadata = await getOidcMetadata(issuer)
    const { payload } = await jwtVerify(logoutToken, metadata.jwks, {
      issuer: metadata.issuer,
      audience: clientId
    })

    const sid = validateLogoutTokenPayload(payload)
    blacklistSession(sid, DEFAULT_ACCESS_TOKEN_MAX_AGE * 1000)

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Backchannel logout error:', error)
    return res.status(400).json({ error: 'Invalid logout_token' })
  }
}
