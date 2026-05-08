import { useEffect } from 'react'
import { useAuthStore } from '@hooks/stores/authStore'
import { useRouter } from 'next/router'
import { clearFederatedStorage } from '@utils/logoutRouter'

export default function LogoutCallback() {
  const router = useRouter()
  const storeLogout = useAuthStore((s) => s.logout)

  useEffect(() => {
    clearFederatedStorage()
    sessionStorage.removeItem('logout_flow')
    localStorage.removeItem('oidc_session')
    localStorage.removeItem('token_expires_at')
    storeLogout()
    router.replace('/auth/login?loggedout=1')
  }, [router, storeLogout])

  return <div>Signing you out...</div>
}
