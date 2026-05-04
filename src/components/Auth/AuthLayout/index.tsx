import { useEffect, useState } from 'react'
import { useAuth } from '@hooks/useAuth'
import LoginForm from '../Login/LoginForm'
import SignupForm from '../Signup/SignupForm'
import {
  authTabLabels,
  OIDC_LOGOUT_PENDING_KEY,
  type AuthPanelContent,
  type AuthTab
} from '../constants'
import BrandPanel from './BrandPanel'
import LogoutPanel from './LogoutPanel'
import SetupPanel from './SetupPanel'
import styles from './index.module.css'

interface AuthLayoutProps {
  content: AuthPanelContent
  initialTab?: AuthTab
}

export default function AuthLayout({
  content,
  initialTab = 'login'
}: AuthLayoutProps) {
  const { isAuthenticated, isLogoutPending } = useAuth()
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab)
  const hasStoredLogoutPending =
    typeof window !== 'undefined' &&
    sessionStorage.getItem(OIDC_LOGOUT_PENDING_KEY) === 'true'
  const showLogoutPending = isLogoutPending || hasStoredLogoutPending

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <BrandPanel content={content} />
        <div className={styles.formPanel}>
          {!isAuthenticated && !showLogoutPending && (
            <div className={styles.pillTabs}>
              <button
                type="button"
                className={`${styles.pillTab} ${
                  activeTab === 'login' ? styles.pillTabActive : ''
                }`}
                onClick={() => setActiveTab('login')}
              >
                {authTabLabels.login}
              </button>
              <button
                type="button"
                className={`${styles.pillTab} ${
                  activeTab === 'signup' ? styles.pillTabActive : ''
                }`}
                onClick={() => setActiveTab('signup')}
              >
                {authTabLabels.signup}
              </button>
            </div>
          )}

          <div className={styles.formContent}>
            {showLogoutPending ? (
              <LogoutPanel />
            ) : isAuthenticated ? (
              <SetupPanel />
            ) : activeTab === 'login' ? (
              <LoginForm />
            ) : (
              <SignupForm />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
