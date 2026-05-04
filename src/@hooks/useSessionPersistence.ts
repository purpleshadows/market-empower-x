import { useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'

export function useSessionPersistence() {
  const { user, logout } = useAuth()

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
          logout()
        }
      } else {
        console.error('Token refresh failed, logging out')
        logout()
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      logout()
    }
  }, [logout])

  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      const tokenExpiresAt = Number(localStorage.getItem('token_expires_at'))
      if (!Number.isFinite(tokenExpiresAt) || tokenExpiresAt <= 0) return

      if (tokenExpiresAt - Date.now() <= 60000) {
        refreshToken()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [user, refreshToken])

  return null
}
