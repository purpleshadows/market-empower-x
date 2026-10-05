import { ReactElement } from 'react'
import Link from 'next/link'
import { useUserPreferences } from '@context/UserPreferences'
import styles from './EmpowerFooter.module.css'

const catalogueUrl = '/search?sort=indexedMetadata.event.block&sortOrder=desc'

export default function EmpowerFooter(): ReactElement {
  const { setShowPPC } = useUserPreferences()

  return (
    <footer className={styles.footer}>
      <div className={styles.grid}>
        <div className={styles.brandColumn}>
          <Link href="/" aria-label="Empower-X home">
            <img src="/logo.svg" alt="Empower-X" className={styles.logo} />
          </Link>
          <p>
            Advanced data sovereignty portal for federated energy ecosystems and
            intelligent urban infrastructure.
          </p>
        </div>
        <div className={styles.column}>
          <h2>Resources</h2>
          <a href="https://docs.empower-x.io/" target="_blank" rel="noreferrer">
            Documentation
          </a>
          <a href="https://docs.empower-x.io/" target="_blank" rel="noreferrer">
            API Reference
          </a>
          <a href="https://empower-x.io/" target="_blank" rel="noreferrer">
            Trust Center
          </a>
        </div>
        <div className={styles.column}>
          <h2>Navigation</h2>
          <Link href={catalogueUrl}>Marketplace</Link>
          <Link href={catalogueUrl}>Services</Link>
          <Link href={catalogueUrl}>Catalogue</Link>
          <Link href="/profile">Governance</Link>
        </div>
        <div className={styles.column}>
          <h2>Privacy</h2>
          <Link href="/privacy/privacy-policy">Privacy Policy</Link>
          <Link href="/privacy/terms">Terms of Service</Link>
          <Link href="/privacy/cookie-policy" onClick={() => setShowPPC(true)}>
            Cookie Settings
          </Link>
        </div>
      </div>
      <div className={styles.bottomBar}>
        <p>© {new Date().getFullYear()} Zertifier. All rights reserved.</p>
        <div className={styles.socialLinks} aria-label="Empower-X links">
          <a
            href="https://empower-x.io/"
            target="_blank"
            rel="noreferrer"
            aria-label="Empower-X website"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </a>
          <a
            href="https://docs.empower-x.io/"
            target="_blank"
            rel="noreferrer"
            aria-label="Empower-X documentation"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </a>
          <a href="mailto:info@empower-x.io" aria-label="Email Empower-X">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  )
}
