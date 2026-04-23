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

const isServer = () => typeof window === 'undefined'

export const getServerSideClientSecret = (): string => {
  if (!isServer()) {
    return ''
  }
  return process.env.NEXT_PUBLIC_OIDC_CLIENT_SECRET || ''
}

export const authConfig = ((): AuthConfig => {
  const runtimeConfig = getRuntimeConfig()

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
      clientSecret: getServerSideClientSecret(),
      redirectUri,
      scope: 'openid profile email federated_identity',
      responseType: 'code',
      pkceMethod: 'S256'
    }
  }
})()

export const getServerSideOidcConfig = () => {
  return {
    ...authConfig.oidc,
    clientSecret: getServerSideClientSecret()
  }
}
