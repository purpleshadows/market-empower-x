import { ReactElement } from 'react'
import LogoAsset from '@images/logo-white.svg'
import styles from './index.module.css'

export default function Logo(): ReactElement {
  return <LogoAsset className={styles.logo} />
}
