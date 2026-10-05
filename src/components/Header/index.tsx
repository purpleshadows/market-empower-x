import { ReactElement } from 'react'
import { useMarketMetadata } from '@context/MarketMetadata'
import EmpowerHeader from './EmpowerHeader'
import Menu from './Menu'

export default function Header(): ReactElement {
  const { siteContent } = useMarketMetadata()
  const isEmpower = siteContent?.siteTitle?.toLowerCase().includes('empower-x')

  if (isEmpower) return <EmpowerHeader />

  return (
    <header>
      <Menu />
    </header>
  )
}
