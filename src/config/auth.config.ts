import { getRuntimeConfig } from '@utils/runtimeConfig'

export interface AuthConfig {
  enabled: boolean
  provider: string
  oidc: {
    issuer: string
    clientId: string
    clientSecret: string
    redirectUri: string
    scope: string
    responseType: string
    pkceMethod: string
  }
}

// Helper to check if we're on the server side
const isServer = () => typeof window === 'undefined'

// Server-side only function to get client secret (not exposed to browser)
export const getServerSideClientSecret = (): string => {
  if (!isServer()) {
    // Client-side: return empty string as secret should not be exposed
    return ''
  }
  // Server-side: read from environment variable
  return process.env.NEXT_PUBLIC_OIDC_CLIENT_SECRET || ''
}

// Main auth config that reads from runtime config (works for both client and server)
export const authConfig = ((): AuthConfig => {
  const runtimeConfig = getRuntimeConfig()

  // For server-side, we can still access process.env directly
  // For client-side, values come from window.__RUNTIME_CONFIG__
  const enabled = isServer()
    ? process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true'
    : runtimeConfig.NEXT_PUBLIC_AUTH_ENABLED === 'true'

  const provider = isServer()
    ? process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'mock'
    : runtimeConfig.NEXT_PUBLIC_AUTH_PROVIDER || 'mock'

  const issuer = isServer()
    ? process.env.NEXT_PUBLIC_OIDC_ISSUER || ''
    : runtimeConfig.NEXT_PUBLIC_OIDC_ISSUER || ''

  const clientId = isServer()
    ? process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || ''
    : runtimeConfig.NEXT_PUBLIC_OIDC_CLIENT_ID || ''

  const redirectUri = isServer()
    ? process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ||
      'http://localhost:8008/auth/callback'
    : runtimeConfig.NEXT_PUBLIC_OIDC_REDIRECT_URI ||
      'http://localhost:8008/auth/callback'

  return {
    enabled,
    provider,
    oidc: {
      issuer,
      clientId,
      clientSecret: getServerSideClientSecret(), // This will be empty on client side
      redirectUri,
      scope: 'openid profile email federated_identity',
      responseType: 'code',
      pkceMethod: 'S256'
    }
  }
})()

// Helper function to get complete OIDC config for server-side operations
export const getServerSideOidcConfig = () => {
  return {
    ...authConfig.oidc,
    clientSecret: getServerSideClientSecret()
  }
}
