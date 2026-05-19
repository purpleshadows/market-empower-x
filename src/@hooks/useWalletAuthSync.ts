import { useEffect, useRef } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAuthStore } from './stores/authStore'
import { authConfig } from '../config/auth.config'

/**
 * Disconnects the wallet after an authenticated session is lost.
 *
 * This only runs on an authenticated -> unauthenticated transition, so an
 * anonymous visitor can still connect a wallet before signing in. When auth
 * is disabled entirely (NEXT_PUBLIC_AUTH_ENABLED !== 'true'), the hook is a
 * no-op regardless of wallet state.
 *
 * Mount once near the app root, under WagmiProvider and the auth provider.
 */
export function useWalletAuthSync(): void {
  const user = useAuthStore((s) => s.user)
  const isSessionVerified = useAuthStore((s) => s.isSessionVerified)
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const wasAuthenticatedRef = useRef(false)

  useEffect(() => {
    if (!authConfig.enabled) return
    if (!isSessionVerified) return

    if (user) {
      wasAuthenticatedRef.current = true
      return
    }

    if (wasAuthenticatedRef.current && isConnected) {
      disconnect()
    }
    wasAuthenticatedRef.current = false
  }, [user, isSessionVerified, isConnected, disconnect])
}
