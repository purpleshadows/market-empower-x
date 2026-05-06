import type { GetServerSideProps } from 'next'
import { authConfig } from '../../../config/auth.config'

// Compatibility shim: Authentik still points to /auth/callback during migration.
// getServerSideProps relays code/state to the server-driven /api/auth/callback,
// where the transient cookies (SameSite=Lax; Path=/api/auth) will be present.
export default function AuthCallback() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  if (!authConfig.enabled) {
    return { redirect: { destination: '/', permanent: false } }
  }

  const { code, state, error } = query

  if (!code && !error) {
    return { redirect: { destination: '/auth/login', permanent: false } }
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
