import { ReactElement } from 'react'
import styles from './Footer.module.css'
import Links from './Links'
import { useMarketMetadata } from '@context/MarketMetadata'
// import Container from '@components/@shared/atoms/Container'
// import Image from 'next/image'
// import logo from '../../../public/images/ecosystem/ocean_enterprise_logo.png'
import Logo from '@images/logo-white.svg'
import EmpowerFooter from './EmpowerFooter'

export default function Footer(): ReactElement {
  const { siteContent } = useMarketMetadata()
  const isEmpower = siteContent?.siteTitle?.toLowerCase().includes('empower-x')

  if (isEmpower) return <EmpowerFooter />

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
            {footer.tagline && (
              <span className={styles.tagline}>{footer.tagline}</span>
            )}
            {footer.website && (
              <a
                className={styles.websiteLink}
                href={footer.website.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {footer.website.name}
              </a>
            )}
          </div>
        </div>
        <Links />
      </div>
      <p className={styles.copyright}>
        {copyright}
        {process.env.NEXT_PUBLIC_APP_VERSION &&
          ` · v${process.env.NEXT_PUBLIC_APP_VERSION}`}
      </p>
    </footer>
  )
}
