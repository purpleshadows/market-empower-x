import type { GetServerSideProps } from 'next'
import { authConfig } from '../../../config/auth.config'

// Compatibility shim: Authentik still points to /auth/callback during migration.
// getServerSideProps relays code/state to the server-driven /api/auth/callback,
// where the transient cookies (SameSite=Lax; Path=/api/auth) will be present.
export default function AuthCallback() {
  return null
}

function getAppLoginDestination(): string {
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (configuredAppUrl) {
    try {
      return `${new URL(configuredAppUrl).origin}/auth/login`
    } catch {}
  }

  const redirectUri = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI
  if (redirectUri) {
    try {
      return `${new URL(redirectUri).origin}/auth/login`
    } catch {}
  }

  return '/auth/login'
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  if (!authConfig.enabled) {
    return { redirect: { destination: '/', permanent: false } }
  }

  const { code, state, error } = query

  if (!code && !error) {
    return {
      redirect: {
        destination: getAppLoginDestination(),
        permanent: false
      }
    }
  }

  const params = new URLSearchParams()
  if (typeof code === 'string') params.set('code', code)
  if (typeof state === 'string') params.set('state', state)
  if (typeof error === 'string') params.set('error', error)

  return {
    redirect: {
      destination: `/api/auth/callback?${params.toString()}`,
      permanent: false
    }
  }
}
