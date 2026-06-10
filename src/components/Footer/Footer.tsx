import { ReactElement } from 'react'
import styles from './Footer.module.css'
import Links from './Links'
import { useMarketMetadata } from '@context/MarketMetadata'
// import Container from '@components/@shared/atoms/Container'
// import Image from 'next/image'
// import logo from '../../../public/images/ecosystem/ocean_enterprise_logo.png'
import Logo from '@images/logo-white.svg'

export default function Footer(): ReactElement {
  const { siteContent } = useMarketMetadata()
  const { footer } = siteContent
  const copyright = footer.copyright.replace(
    /\b\d{4}\b/g,
    String(new Date().getFullYear())
  )

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.logoSection}>
          <Logo className={styles.logo} />
          <div className={styles.taglineContainer}>
            <span className={styles.tagline}>
              Empower-X trusted data space for Europe&apos;s energy transition.
            </span>
            <a
              className={styles.websiteLink}
              href="https://empower-x.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              empower-x.io
            </a>
          </div>
        </div>
        <Links />
      </div>
      <p className={styles.copyright}>{copyright}</p>
    </footer>
  )
}
