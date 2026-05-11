import { useCallback, useEffect, useRef } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAuth, verifyAuthSessionDetailed } from './useAuth'
import { useAuthStore } from './stores/authStore'
import { useSsiWallet } from '@context/SsiWallet'
import { disconnectFromWallet } from '@utils/wallet/ssiWallet'
import { clearFederatedStorage } from '@utils/logoutRouter'
import {
  AUTH_SESSION_LOST_EVENT,
  REFRESH_LEAD_MS,
  RETRY_DELAY_MS,
  SESSION_POLL_INTERVAL_MS,
  DEFINITIVE_REFRESH_FAILURE_STATUSES
} from './_constants'

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
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const setExpiresAt = useAuthStore((s) => s.setExpiresAt)
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const {
    setSessionToken,
    ssiWalletCache,
    setCachedCredentials,
    clearVerifierSessionCache
  } = useSsiWallet()
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

  const disconnectWallets = useCallback(async () => {
    try {
      if (address) {
        await disconnect()
      }
    } catch (error) {
      console.error(
        'Web3 wallet disconnect failed during session expiry',
        error
      )
    }

    try {
      ssiWalletCache.clearCredentials()
      setCachedCredentials([])
      clearVerifierSessionCache()
      setSessionToken(undefined)
      await disconnectFromWallet()
    } catch (error) {
      console.error('SSI wallet disconnect failed during session expiry', error)
    }

    clearFederatedStorage()
  }, [
    address,
    clearVerifierSessionCache,
    disconnect,
    ssiWalletCache,
    setCachedCredentials,
    setSessionToken
  ])

  const refreshToken = useCallback(async (): Promise<RefreshResult> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const { expires_in: newExpiresIn } = await response.json()
        if (typeof newExpiresIn === 'number' && newExpiresIn > 0) {
          const newExpiresAt = Date.now() + newExpiresIn * 1000
          // Updating the store re-arms the scheduling effect below, which is
          // how we get continuous refresh without any setInterval.
          setExpiresAt(newExpiresAt)
          localStorage.setItem('token_expires_at', String(newExpiresAt))
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
  }, [setExpiresAt])

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

      return { status: 'logout', reason: 'session_invalid' }
    } catch {
      return { status: 'retry', reason: 'session_check_transient_error' }
    }
  }, [])

  useEffect(() => {
    if (!authEnabled) return

    let cancelled = false

    const completeSessionLoss = async () => {
      if (logoutHandledRef.current) return
      logoutHandledRef.current = true
      try {
        await disconnectWallets()
      } finally {
        if (!cancelled) clearLocalSession('/api/auth/logout')
      }
    }

    const handleSessionLost = () => {
      if (cancelled || logoutHandledRef.current) return

      completeSessionLoss().catch((error) => {
        console.error('Session loss cleanup failed', error)
      })
    }

    window.addEventListener(AUTH_SESSION_LOST_EVENT, handleSessionLost)

    return () => {
      cancelled = true
      window.removeEventListener(AUTH_SESSION_LOST_EVENT, handleSessionLost)
    }
  }, [authEnabled, disconnectWallets, clearLocalSession])

  useEffect(() => {
    if (!authEnabled || !isAuthenticated || !isSessionVerified || !user) return
    if (!expiresAt) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const runRefreshCycle = async () => {
      if (cancelled || refreshInFlightRef.current || logoutHandledRef.current) {
        return
      }
      refreshInFlightRef.current = true

      try {
        const sessionResult = await checkSession()
        if (cancelled) return

        if (sessionResult.status === 'logout') {
          await disconnectWallets()
          clearLocalSessionOnce()
          return
        }

        if (sessionResult.status === 'retry') {
          timer = setTimeout(runRefreshCycle, RETRY_DELAY_MS)
          return
        }

        if (
          sessionResult.status === 'valid' &&
          !sessionResult.hasRefreshToken
        ) {
          return
        }

        const result = await refreshToken()
        if (cancelled) return

        if (result.status === 'logout') {
          await disconnectWallets()
          clearLocalSessionOnce()
          return
        }

        if (result.status === 'retry') {
          timer = setTimeout(runRefreshCycle, RETRY_DELAY_MS)
        }
      } finally {
        refreshInFlightRef.current = false
      }
    }

    const initialDelay = Math.max(0, expiresAt - Date.now() - REFRESH_LEAD_MS)
    timer = setTimeout(runRefreshCycle, initialDelay)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [
    authEnabled,
    isAuthenticated,
    isSessionVerified,
    user,
    expiresAt,
    refreshToken,
    checkSession,
    disconnectWallets,
    clearLocalSessionOnce
  ])

  // Cheap revocation pickup between refresh cycles: poll every 2 min and
  // re-check whenever the tab returns to the foreground. Session-only check —
  // refresh is left to the scheduled cycle above.
  useEffect(() => {
    if (!authEnabled || !isAuthenticated || !isSessionVerified || !user) return

    let cancelled = false

    const verifySession = async () => {
      if (cancelled || refreshInFlightRef.current || logoutHandledRef.current) {
        return
      }
      const result = await checkSession()
      if (cancelled) return
      if (result.status === 'logout') {
        await disconnectWallets()
        clearLocalSessionOnce()
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') verifySession()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const intervalId = setInterval(verifySession, SESSION_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(intervalId)
    }
  }, [
    authEnabled,
    isAuthenticated,
    isSessionVerified,
    user,
    checkSession,
    disconnectWallets,
    clearLocalSessionOnce
  ])

  return null
}
