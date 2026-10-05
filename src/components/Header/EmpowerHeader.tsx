import { ReactElement } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

import AuthEntry from './AuthEntry'
import Networks from './UserPreferences/Networks'
import UserPreferences from './UserPreferences'
import Wallet from './Wallet'
import { SsiWallet } from './SsiWallet'
import { useAuth } from '@hooks/useAuth'
import { useMarketMetadata } from '@context/MarketMetadata'
import styles from './EmpowerHeader.module.css'

const catalogueUrl = '/search?sort=indexedMetadata.event.block&sortOrder=desc'

export default function EmpowerHeader(): ReactElement {
  const router = useRouter()
  const { validatedSupportedChains } = useMarketMetadata()
  const { isAuthenticated, authEnabled } = useAuth()
  const canAccessWalletControls = !authEnabled || isAuthenticated
  const isOnCatalogue = router.pathname === '/search'

  return (
    <nav className={styles.topBar} aria-label="Primary navigation">
      <div className={styles.topBarInner}>
        <Link href="/" className={styles.logoLink} aria-label="Empower-X home">
          <img src="/logo.svg" alt="Empower-X" className={styles.logo} />
        </Link>
        <div className={styles.headerActions}>
          <div className={styles.utilityActions}>
            {validatedSupportedChains.length > 1 && <Networks />}
            <UserPreferences />
          </div>
          <button
            type="button"
            className={styles.navPublish}
            onClick={() => router.push('/publish/1')}
          >
            Publish Asset
          </button>
          {!isOnCatalogue && (
            <Link href={catalogueUrl} className={styles.navCatalogue}>
              Go to Catalogue
            </Link>
          )}
          {canAccessWalletControls && (
            <div className={styles.walletControl}>
              <Wallet />
            </div>
          )}
          <AuthEntry
            authenticatedContent={
              <SsiWallet walletRequiredMessage="You need to connect to your wallet first" />
            }
            loginClassName={styles.accountButton}
            buttonContentClassName={styles.accountButtonContent}
            buttonTextClassName={styles.accountButtonText}
            loginLabel="Account"
          />
        </div>
      </div>
    </nav>
  )
}
