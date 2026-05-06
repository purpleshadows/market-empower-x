import { useCallback, useEffect } from 'react'
import { useAuth, verifyAuthSession } from './useAuth'

export function useSessionPersistence() {
  const { user, clearLocalSession } = useAuth()

  const checkSession = useCallback(async () => {
    try {
      const verifiedUser = await verifyAuthSession()
      if (!verifiedUser) {
        clearLocalSession()
      }
    } catch {
      // network error — transient, don't logout
    }
  }, [clearLocalSession])

  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST'
      })

      if (response.ok) {
        const { expires_in: newExpiresIn } = await response.json()
        if (typeof newExpiresIn === 'number' && newExpiresIn > 0) {
          localStorage.setItem(
            'token_expires_at',
            String(Date.now() + newExpiresIn * 1000)
          )
        } else {
          console.error(
            'Token refresh response missing expires_in, logging out'
          )
          clearLocalSession()
        }
      } else if (response.status !== 503 && response.status !== 504) {
        // Only logout on definitive failures (401/400), not transient server errors
        console.error('Token refresh failed, logging out', response.status)
        clearLocalSession()
      }
    } catch (error) {
      // Network error — transient, don't logout (matches checkSession behavior)
      console.error('Token refresh network error, will retry:', error)
    }
  }, [clearLocalSession])

  useEffect(() => {
    if (!user) return

    const checkAndRefresh = () => {
      const tokenExpiresAt = Number(localStorage.getItem('token_expires_at'))
      if (!Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= 0) {
        refreshToken()
        return
      }

      if (tokenExpiresAt - Date.now() <= 60000) {
        refreshToken()
      } else {
        checkSession()
      }
    }

    checkAndRefresh()

    const interval = setInterval(checkAndRefresh, 30000)

    return () => clearInterval(interval)
  }, [user, refreshToken, checkSession])

  return null
}
