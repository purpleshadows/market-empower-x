#!/usr/bin/env node
// Generates the per-deployment secrets for the SSI stack and prints them as
// KEY=value lines to paste into the Portainer stack environment.
//
//   node deploy/ssi/scripts/generate-secrets.mjs
//
// The upstream walt.id configs ship fixed example keys that are public on
// GitHub; with those anyone could forge wallet sessions. Never reuse them.
import { generateKeyPairSync, randomBytes, randomInt } from 'node:crypto'

const ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomString(length) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

// Login-token signing key for the wallet (ktor-authnz), Ed25519 JWK.
const { privateKey } = generateKeyPairSync('ed25519')
const jwk = privateKey.export({ format: 'jwk' })
const authnzKey = {
  type: 'jwk',
  jwk: { kty: jwk.kty, d: jwk.d, use: 'sig', crv: jwk.crv, x: jwk.x }
}

const secrets = {
  WALLET_ENCRYPTION_KEY: randomString(16), // 128 bit, exactly 16 chars
  WALLET_SIGN_KEY: randomString(16), // 128 bit, exactly 16 chars
  WALLET_TOKEN_KEY: randomString(48), // 256+ bit
  WALLET_PEPPER: randomString(24),
  WALLET_AUTHNZ_JWK: JSON.stringify(authnzKey),
  DB_PASSWORD: randomBytes(24).toString('base64url')
}

for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`)
}
