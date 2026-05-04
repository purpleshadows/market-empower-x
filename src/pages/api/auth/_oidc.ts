import { createRemoteJWKSet } from 'jose'
import { OIDC_DISCOVERY_PATH, OIDC_REQUEST_TIMEOUT_MS } from './_constants'

export const oidcMetadataCache = new Map<
  string,
  {
    issuer: string
    jwks: ReturnType<typeof createRemoteJWKSet>
  }
>()

export async function getOidcMetadata(issuer: string) {
  const normalizedIssuer = issuer.replace(/\/$/, '')
  const cached = oidcMetadataCache.get(normalizedIssuer)
  if (cached) return cached

  const discoveryUrl = `${normalizedIssuer}${OIDC_DISCOVERY_PATH}`
  const response = await fetch(discoveryUrl, {
    signal: AbortSignal.timeout(OIDC_REQUEST_TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error('Unable to load OIDC discovery document')
  }

  const discovery = await response.json()
  if (!discovery.jwks_uri) {
    throw new Error('OIDC discovery document missing jwks_uri')
  }

  const metadata = {
    issuer: typeof discovery.issuer === 'string' ? discovery.issuer : issuer,
    jwks: createRemoteJWKSet(new URL(discovery.jwks_uri))
  }
  oidcMetadataCache.set(normalizedIssuer, metadata)
  return metadata
}
