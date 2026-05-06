import { useAuthStore, User } from './stores/authStore'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { authConfig } from '../config/auth.config'
import React from 'react'
import {
  clearPendingAuthMode,
  clearPendingCallbackUrl,
  setPendingAuthMode,
  setPendingCallbackUrl,
  type PendingAuthMode
} from '@utils/authFlow'

const OIDC_LOGOUT_PENDING_KEY = 'oidc_logout_pending'
const OIDC_LOGOUT_STATE_KEY = 'oidc_logout_state'
const OIDC_LOGOUT_STARTED_AT_KEY = 'oidc_logout_started_at'

const getUserDataFromSessionResponse = (user: {
  id?: string
  email?: string
  name?: string
  username?: string
}): User => {
  return {
    id: user.id || '',
    email: user.email || '',
    name: user.name || '',
    username: user.username,
    avatar: `https://ui-avatars.com/api/?name=${user.name || ''}`,
    isOnboarded: false,
    authProvider: 'oidc'
  }
}

const clearOidcStorage = () => {
  localStorage.removeItem('oidc_session')
  localStorage.removeItem('token_expires_at')
  localStorage.removeItem('auth_meta')
  sessionStorage.removeItem('oidc_pkce_code_verifier')
  sessionStorage.removeItem('oidc_login_state')
  sessionStorage.removeItem('oidc_login_nonce')
  sessionStorage.removeItem('oidc_processing')
  sessionStorage.removeItem(OIDC_LOGOUT_STATE_KEY)
  sessionStorage.removeItem(OIDC_LOGOUT_PENDING_KEY)
  sessionStorage.removeItem(OIDC_LOGOUT_STARTED_AT_KEY)
  clearPendingAuthMode()
  clearPendingCallbackUrl()
}

export const useAuth = () => {
  const {
    user,
    isLoading,
    isLogoutPending,
    setUser,
    setLoading,
    setLogoutPending,
    logout: storeLogout
  } = useAuthStore()
  const authEnabled = authConfig.enabled
  const router = useRouter()

  // Hydrate user data from localStorage on mount (existing sessions)
  React.useEffect(() => {
    try {
      const session = localStorage.getItem('oidc_session')
      if (!session) return
      const parsedSession = JSON.parse(session) as User
      setUser(parsedSession)
    } catch {}
  }, [setUser])

  // After server-driven callback, ?hydrated=1 signals us to fetch session data
  React.useEffect(() => {
    if (!router.isReady) return
    if (router.query.hydrated !== '1') return

    const { hydrated: _, ...rest } = router.query
    router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true
    })

    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) return
        const userData = getUserDataFromSessionResponse(data.user)
        localStorage.setItem('oidc_session', JSON.stringify(userData))
        localStorage.setItem(
          'token_expires_at',
          String(Date.now() + (data.expires_in ?? 3600) * 1000)
        )
        if (data.authMeta) {
          localStorage.setItem('auth_meta', JSON.stringify(data.authMeta))
        }
        setUser(userData)
      })
      .catch(() => {})
  }, [router, setUser])

  const clearLocalSession = React.useCallback(() => {
    clearOidcStorage()
    setLogoutPending(false)
    storeLogout()
    router.replace('/auth/login')
  }, [router, setLogoutPending, storeLogout])

  const login = async (mode: PendingAuthMode = 'login') => {
    setLoading(true)
    try {
      const callbackUrl =
        typeof router.query.callbackUrl === 'string'
          ? router.query.callbackUrl
          : null
      clearOidcStorage()
      setPendingAuthMode(mode)
      if (callbackUrl) {
        setPendingCallbackUrl(callbackUrl)
      } else {
        clearPendingCallbackUrl()
      }

      const params = new URLSearchParams()
      if (callbackUrl) params.set('callbackUrl', callbackUrl)
      const qs = params.toString() ? `?${params.toString()}` : ''
      window.location.href =
        mode === 'signup' ? `/api/auth/signup${qs}` : `/api/auth/login${qs}`
    } finally {
      setLoading(false)
    }
  }

  const beginOidcFlow = async (mode: PendingAuthMode) => {
    await login(mode)
  }

  const logout = async () => {
    setLoading(true)
    try {
      const isFederatedCallback =
        sessionStorage.getItem('logout_flow') === 'federated'
      const federatedTimeout =
        sessionStorage.getItem('federated_logout_timeout') === 'true'

      if (isFederatedCallback || federatedTimeout) {
        sessionStorage.removeItem('logout_flow')
        sessionStorage.removeItem('federated_logout_timeout')
      }

      if (user?.authProvider === 'oidc') {
        setLogoutPending(true)
        clearOidcStorage()
        storeLogout()

        if (isFederatedCallback || federatedTimeout) {
          // Federated return path: POST to revoke + get logoutUrl, then follow it
          const state = Math.random().toString(36).substring(2)
          sessionStorage.setItem(OIDC_LOGOUT_STATE_KEY, state)
          sessionStorage.setItem(OIDC_LOGOUT_PENDING_KEY, 'true')
          sessionStorage.setItem(
            OIDC_LOGOUT_STARTED_AT_KEY,
            Date.now().toString()
          )
          const res = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state })
          })
          if (!res.ok) throw new Error('Logout request failed')
          const { logoutUrl } = await res.json()
          window.location.href = logoutUrl
          return
        }

        // Standard path: server-driven GET logout
        window.location.href = '/api/auth/logout'
        return
      }

      clearLocalSession()
    } catch (error) {
      setLogoutPending(false)
      console.error('Logout flow failed:', error)
      toast.error('Logout failed')
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    isLoading,
    isLogoutPending,
    isAuthenticated: !!user,
    login,
    beginOidcFlow,
    logout,
    clearLocalSession,
    authEnabled
  }
}
