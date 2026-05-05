import { useEffect } from 'react'
import { useAuthStore } from '@hooks/stores/authStore'
import { useAuth } from '@hooks/useAuth'
import { useRouter } from 'next/router'
import {
  clearFederatedStorage,
  restoreFederatedSessionData
} from '@utils/logoutRouter'

export default function LogoutCallback() {
  const router = useRouter()
  const storeLogout = useAuthStore((s) => s.logout)
  const { logout } = useAuth()

  useEffect(() => {
    const flow = sessionStorage.getItem('logout_flow')
    const isTimeout =
      sessionStorage.getItem('federated_logout_timeout') === 'true'
    const timeoutId = sessionStorage.getItem('federated_timeout_id')

    if (timeoutId) {
      clearTimeout(parseInt(timeoutId))
      sessionStorage.removeItem('federated_timeout_id')
    }

    if (isTimeout) {
      sessionStorage.removeItem('federated_logout_timeout')
    }

    const run = async () => {
      if (flow === 'federated' || isTimeout) {
        sessionStorage.removeItem('logout_flow')

        if (!isTimeout) {
          restoreFederatedSessionData()
        }

        clearFederatedStorage()
        await logout()
      } else {
        localStorage.removeItem('oidc_session')
        localStorage.removeItem('token_expires_at')
        storeLogout()
        router.replace('/auth/login')
      }
    }

    run()
  }, [router, storeLogout, logout])

  return <div>Signing you out...</div>
}
