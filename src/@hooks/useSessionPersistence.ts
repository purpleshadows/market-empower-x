import { useCallback, useEffect, useRef } from 'react'
import { useAuth, verifyAuthSessionDetailed } from './useAuth'

const SESSION_REFRESH_INTERVAL_MS = 30000
const DEFINITIVE_REFRESH_FAILURE_STATUSES = new Set([400, 401, 403])

type RefreshResult =
  | { status: 'success'; expiresIn: number }
  | { status: 'logout'; reason: string }
  | { status: 'retry'; reason: string }

type SessionCheckResult =
  | { status: 'valid'; hasRefreshToken: boolean }
  | { status: 'refresh_required' }
  | { status: 'logout'; reason: string }
  | { status: 'retry'; reason: string }

export function useSessionPersistence() {
  const {
    user,
    isAuthenticated,
    isSessionVerified,
    authEnabled,
    clearLocalSession
  } = useAuth()
  const logoutHandledRef = useRef(false)
  const refreshInFlightRef = useRef(false)

  useEffect(() => {
    if (user) logoutHandledRef.current = false
  }, [user])

  const clearLocalSessionOnce = useCallback(() => {
    if (logoutHandledRef.current) return
    logoutHandledRef.current = true
    clearLocalSession()
  }, [clearLocalSession])

  const refreshToken = useCallback(async (): Promise<RefreshResult> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const { expires_in: newExpiresIn } = await response.json()
        if (typeof newExpiresIn === 'number' && newExpiresIn > 0) {
          localStorage.setItem(
            'token_expires_at',
            String(Date.now() + newExpiresIn * 1000)
          )
          return { status: 'success', expiresIn: newExpiresIn }
        }

        console.error('Token refresh response missing expires_in')
        return { status: 'logout', reason: 'invalid_refresh_response' }
      }

      if (DEFINITIVE_REFRESH_FAILURE_STATUSES.has(response.status)) {
        console.error('Token refresh failed definitively', response.status)
        return { status: 'logout', reason: `refresh_${response.status}` }
      }

      console.error('Token refresh failed, will retry', response.status)
      return { status: 'retry', reason: `refresh_${response.status}` }
    } catch (error) {
      console.error('Token refresh network error, will retry:', error)
      return { status: 'retry', reason: 'refresh_network_error' }
    }
  }, [])

  const checkSession = useCallback(async (): Promise<SessionCheckResult> => {
    try {
      const session = await verifyAuthSessionDetailed({ allowRefresh: false })
      if (session.user) {
        return {
          status: 'valid',
          hasRefreshToken: session.hasRefreshToken
        }
      }

      if (session.refreshRequired && session.hasRefreshToken) {
        return { status: 'refresh_required' }
      }

      if (!session.user) {
        return { status: 'logout', reason: 'session_invalid' }
      }
    } catch {
      return { status: 'retry', reason: 'session_check_transient_error' }
    }
  }, [])

  useEffect(() => {
    if (!authEnabled || !isAuthenticated || !isSessionVerified || !user) return

    const checkAndRefresh = async () => {
      if (refreshInFlightRef.current || logoutHandledRef.current) return
      refreshInFlightRef.current = true

      try {
        const initialSessionResult = await checkSession()

        if (initialSessionResult.status === 'logout') {
          clearLocalSessionOnce()
          return
        }

        if (initialSessionResult.status === 'retry') return

        if (
          initialSessionResult.status === 'valid' &&
          !initialSessionResult.hasRefreshToken
        ) {
          return
        }

        const result = await refreshToken()

        if (result.status === 'logout') {
          clearLocalSessionOnce()
          return
        }

        if (result.status !== 'success') return

        const sessionResult = await checkSession()
        if (sessionResult.status === 'logout') {
          clearLocalSessionOnce()
        }
      } finally {
        refreshInFlightRef.current = false
      }
    }

    checkAndRefresh()
    const interval = setInterval(checkAndRefresh, SESSION_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [
    authEnabled,
    isAuthenticated,
    isSessionVerified,
    user,
    refreshToken,
    checkSession,
    clearLocalSessionOnce
  ])

  return null
}
