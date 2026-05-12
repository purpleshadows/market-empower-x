import { useEffect } from 'react'
import { useAuthStore } from '@hooks/stores/authStore'
import { clearFederatedStorage } from '@utils/logoutRouter'

export default function LogoutCallback() {
  const storeLogout = useAuthStore((s) => s.logout)

  useEffect(() => {
    clearFederatedStorage()
    localStorage.removeItem('oidc_session')
    localStorage.removeItem('token_expires_at')
    storeLogout()
    window.location.replace('/api/auth/logout/continue')
  }, [storeLogout])

  return <div>Signing you out...</div>
}
