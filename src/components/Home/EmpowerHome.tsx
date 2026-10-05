import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactElement,
  useEffect,
  useRef,
  useState
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { useAccount, useChainId } from 'wagmi'

import EmpowerHeader from '@components/Header/EmpowerHeader'
import Wallet from '@components/Header/Wallet'
import { SsiWallet } from '@components/Header/SsiWallet'
import { tokenLogos } from '@components/Header/NetworkMenu/AddTokenList'
import { useMarketMetadata } from '@context/MarketMetadata'
import { useSearchBarStatus } from '@context/SearchBarStatus'
import { useUserPreferences } from '@context/UserPreferences'
import { addTokenToWallet } from '@utils/wallet'
import { addExistingParamsToUrl } from '../Search/utils'
import styles from './EmpowerHome.module.css'

const catalogueUrl = '/search?sort=indexedMetadata.event.block&sortOrder=desc'

const computeImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCytLG3owhmO_CMW9FLEqT7Vjl0Sw0GisQypuvBtgUSwidPxfMdUCR6G70G0zu6xfq-nf4KKSJ41sRtMT4fNe5OQ7dlBgCysLIknKl63Xi6Ve7f7eXaS1_Tp-Gr08AXTSL6WozAFUwTjQeQehiYkgH6bL0GBtqJrDmeJ2_0qtrQupuQFk43efrtzzIFqFvnPtaOnkSkLbyA7Pojvq5quCWjivqH291SKay2NXnCqOhk_P4BAwamrCkZhcH6rEsFJZ7hRG9yeWNuB_II'
const visionImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBTrNZIE_fqheJBM1zwRycTpLWb9JIfVUn9zfFElFAKaXjKXZ0CCzvA06KzwiewD9DOpCLkY8VEmabijJ3kVRWH7fpGO64YsjZ4F0Vtf5O93AFpnkKjpF1o0zM0LAgAWt6hmB8jUu1uxvdcKk1YxsKRnLSQTGKlCQ5UuxWsE1Y4PXSHA8hLxTgT27Sup_NES2CGaDmbqRZFNv_GXqfTJU0zWSvlg1AwdFuOVgsRO_bYbk3ZWo0ar6kGrqj74vE-wuF8KE7LZ3UZDhRX'

type IconName =
  | 'publish'
  | 'search'
  | 'catalogue'
  | 'wallet'
  | 'connect'
  | 'tokens'
  | 'funds'
  | 'ssi'
  | 'ready'
  | 'sovereignty'
  | 'interoperability'
  | 'business'
  | 'governance'
  | 'security'
  | 'check'

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactElement> = {
    publish: (
      <>
        <path d="M12 3v12m0-12 4 4m-4-4L8 7" />
        <path d="M5 12v7h14v-7" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4 4" />
      </>
    ),
    catalogue: (
      <>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7h15v12H4z" />
        <path d="M4 7V5h12v2m0 5h4v4h-4a2 2 0 0 1 0-4Z" />
      </>
    ),
    connect: (
      <>
        <path d="M9 15 7 17a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0" />
        <path d="m15 9 2-2a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-6 0" />
        <path d="m8 16 8-8" />
      </>
    ),
    tokens: (
      <>
        <circle cx="10" cy="12" r="6" />
        <path d="M10 9v6m-2-4.5h3.2a1.5 1.5 0 0 1 0 3H8" />
        <path d="M18 7v6m-3-3h6" />
      </>
    ),
    funds: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18m-6 5h3" />
        <path d="m7 3 2-2 2 2" />
      </>
    ),
    ssi: (
      <>
        <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    ready: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    sovereignty: (
      <>
        <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" />
        <rect x="9" y="10" width="6" height="5" />
        <path d="M10 10V8.5a2 2 0 0 1 4 0V10" />
      </>
    ),
    interoperability: (
      <>
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="17" r="2" />
        <circle cx="19" cy="17" r="2" />
        <path d="m10.8 6.8-4.6 8.4m7-8.4 4.6 8.4M7 17h10" />
      </>
    ),
    business: (
      <>
        <rect x="3" y="6" width="18" height="13" />
        <path d="M7 6V4h10v2M3 11h18m-11 3h4" />
      </>
    ),
    governance: (
      <>
        <path d="M4 7h16M7 7v11m5-11v11m5-11v11M3 20h18M12 3 3 7h18l-9-4Z" />
      </>
    ),
    security: (
      <>
        <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

async function clearSearch() {
  const searchParams = new URLSearchParams(window.location.href)
  const text = searchParams.get('text')

  if (text) {
    await addExistingParamsToUrl(location, ['text', 'owner', 'tags'])
  }
}

function Hero(): ReactElement {
  const router = useRouter()
  const [value, setValue] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const {
    isSearchBarVisible,
    setSearchBarVisible,
    homeSearchBarFocus,
    setHomeSearchBarFocus
  } = useSearchBarStatus()

  useEffect(() => {
    setSearchBarVisible(false)
    setHomeSearchBarFocus(false)
  }, [setSearchBarVisible, setHomeSearchBarFocus])

  useEffect(() => {
    if ((isSearchBarVisible || homeSearchBarFocus) && searchInput.current) {
      searchInput.current.focus()
    }
  }, [homeSearchBarFocus, isSearchBarVisible])

  async function startSearch() {
    const url = await addExistingParamsToUrl(location, [
      'text',
      'owner',
      'tags'
    ])
    router.push(`${url}&text=${encodeURIComponent(value || ' ')}`)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value)
    if (event.target.value === '') clearSearch()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startSearch()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      startSearch()
    }
  }

  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <span className={styles.eyebrow}>
          Energy Sovereignty Infrastructure
        </span>
        <h1>Empower-X: Data Infrastructure for Intelligent Energy Systems.</h1>
        <p className={styles.heroCopy}>
          Discover, share, process and monetize energy, mobility and urban data
          in a federated, secure and auditable environment designed for European
          data sovereignty.
        </p>
        <div className={styles.heroActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.push('/publish/1')}
          >
            <Icon name="publish" />
            Publish an Asset
          </button>
          <form className={styles.searchForm} onSubmit={handleSubmit}>
            <Icon name="search" className={styles.searchIcon} />
            <input
              ref={searchInput}
              type="search"
              name="search"
              value={value}
              placeholder="Search for data assets, services, or providers..."
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              aria-label="Search the Empower-X catalogue"
            />
          </form>
        </div>
        <Link className={styles.catalogueLink} href={catalogueUrl}>
          <Icon name="catalogue" />
          Go to Catalogue
        </Link>
      </div>
    </section>
  )
}

const mainnetChainIds = [1, 10, 56, 137, 43114, 42161, 8453, 100]

const onboardingSteps = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: 'wallet' as IconName,
    title: 'Setup MetaMask',
    copy: 'To interact with the portal, you need to install and create an account with MetaMask. This allows you to securely manage your data assets and credentials.'
  },
  {
    id: 'connect',
    name: 'Connect',
    icon: 'connect' as IconName,
    title: 'Connect your account',
    copy: 'Connect a supported wallet to select the correct network and start interacting with the Empower-X data space.'
  },
  {
    id: 'tokens',
    name: 'Tokens',
    icon: 'tokens' as IconName,
    title: 'Import marketplace tokens',
    copy: 'Add the marketplace payment tokens to MetaMask so balances and purchases are easy to identify on the connected network.'
  },
  {
    id: 'funds',
    name: 'Faucet',
    icon: 'funds' as IconName,
    title: 'Request test tokens',
    copy: 'Use a faucet to request the gas and payment tokens required to test transactions without spending real funds.'
  },
  {
    id: 'ssi',
    name: 'SSI',
    icon: 'ssi' as IconName,
    title: 'Verify your identity',
    copy: 'Add your self-sovereign identity credential so providers can grant trusted access without giving up control of your personal data.'
  },
  {
    id: 'ready',
    name: 'Ready',
    icon: 'ready' as IconName,
    title: 'You are ready',
    copy: 'Your setup is complete. You can now discover services, publish assets and participate in the federated data space.'
  }
]

function QuickStart(): ReactElement {
  const [currentStep, setCurrentStep] = useState(0)
  const [tokenBeingAdded, setTokenBeingAdded] = useState<string>()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { approvedBaseTokens } = useMarketMetadata()
  const { showOnboardingModule } = useUserPreferences()
  const isMainnet = mainnetChainIds.includes(chainId)
  const steps = onboardingSteps.map((step) =>
    step.id === 'funds'
      ? {
          ...step,
          name: isMainnet ? 'Funds' : 'Faucet',
          title: isMainnet ? 'Add wallet funds' : 'Request test tokens',
          copy: isMainnet
            ? 'Fund your wallet with the network gas token and any payment token required by the asset or service you want to access.'
            : 'Use a faucet to request the gas and payment tokens required to test transactions without spending real funds.'
        }
      : step
  )
  const step = steps[currentStep]
  const importableTokens =
    approvedBaseTokens?.filter((token) =>
      token.symbol.toLowerCase().includes('euro')
    ) || []
  const fundingLinks = isMainnet
    ? [
        { label: 'Kraken', url: 'https://www.kraken.com/' },
        { label: 'Crypto.com', url: 'https://crypto.com/' },
        { label: 'Bitpanda', url: 'https://www.bitpanda.com/' },
        { label: 'Coinbase', url: 'https://www.coinbase.com/' }
      ]
    : chainId === 11155420
    ? [
        {
          label: 'OP Sepolia Faucet',
          url: 'https://www.alchemy.com/faucets/optimism-sepolia'
        },
        { label: 'Circle Token Faucet', url: 'https://faucet.circle.com/' }
      ]
    : [
        {
          label: 'ETH Sepolia Faucet',
          url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'
        },
        { label: 'Circle Token Faucet', url: 'https://faucet.circle.com/' }
      ]

  async function importToken(token: TokenInfo) {
    if (!isConnected || !window.ethereum?.request) {
      toast.error('Connect MetaMask before importing a token.')
      return
    }

    setTokenBeingAdded(token.symbol)
    try {
      await addTokenToWallet(
        token.address,
        token.symbol,
        token.decimals,
        tokenLogos?.[token.symbol]?.url
      )
      toast.success(`MetaMask opened for ${token.symbol}.`)
    } catch {
      toast.error(
        `Could not import ${token.symbol}. Check your wallet network.`
      )
    } finally {
      setTokenBeingAdded(undefined)
    }
  }

  function continueSetup() {
    setCurrentStep((current) => Math.min(current + 1, steps.length - 1))
  }

  if (!showOnboardingModule) return <></>

  return (
    <section className={styles.quickStart}>
      <div className={styles.sectionContainer}>
        <div className={styles.quickStartHeader}>
          <h2>First Time Visiting?</h2>
          <p>
            Before interacting with the portal functionalities, ensure you have
            the correct setup. We can help you jump-start the process!
          </p>
        </div>
        <div className={styles.setupCard}>
          <ol className={styles.setupSteps}>
            {steps.map((item, index) => (
              <li
                key={item.id}
                className={index === currentStep ? styles.activeStep : ''}
              >
                <button type="button" onClick={() => setCurrentStep(index)}>
                  <span className={styles.stepIcon}>
                    <Icon name={item.icon} />
                  </span>
                  <span>
                    {index + 1}. {item.name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.setupContent}>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
            <div className={styles.setupActions}>
              {step.id === 'metamask' && (
                <>
                  <a
                    className={styles.primaryButton}
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download MetaMask
                  </a>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={continueSetup}
                  >
                    I already have it
                  </button>
                </>
              )}
              {step.id === 'connect' && (
                <>
                  <div className={styles.onboardingWallet}>
                    <Wallet />
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={continueSetup}
                  >
                    {isConnected ? 'Continue' : 'Continue setup'}
                  </button>
                </>
              )}
              {step.id === 'tokens' && (
                <>
                  {importableTokens.length > 0 ? (
                    importableTokens.map((token) => (
                      <button
                        key={token.address}
                        type="button"
                        className={styles.secondaryButton}
                        disabled={tokenBeingAdded === token.symbol}
                        onClick={() => importToken(token)}
                      >
                        {tokenBeingAdded === token.symbol
                          ? `Adding ${token.symbol}...`
                          : `Import ${token.symbol}`}
                      </button>
                    ))
                  ) : (
                    <p className={styles.setupNote}>
                      Connect a supported network to see its available payment
                      tokens.
                    </p>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={continueSetup}
                  >
                    Continue
                  </button>
                </>
              )}
              {step.id === 'funds' && (
                <>
                  {fundingLinks.map((link) => (
                    <a
                      key={link.label}
                      className={styles.secondaryButton}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label} <span aria-hidden="true">{'\u2197'}</span>
                    </a>
                  ))}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={continueSetup}
                  >
                    Continue
                  </button>
                </>
              )}
              {step.id === 'ssi' && (
                <>
                  <div className={styles.onboardingSsi}>
                    <SsiWallet walletRequiredMessage="Connect your wallet before configuring SSI" />
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={continueSetup}
                  >
                    Continue
                  </button>
                </>
              )}
              {step.id === 'ready' && (
                <Link className={styles.primaryButton} href={catalogueUrl}>
                  Explore the Catalogue
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const standards = [
  {
    icon: 'sovereignty' as IconName,
    title: 'Data Sovereignty & Privacy',
    copy: "Data Rooms provide secure and auditable environments where the data always remains under the owner's control, even during processing."
  },
  {
    icon: 'interoperability' as IconName,
    title: 'Complete Interoperability',
    copy: 'Standardised connectivity between municipalities, grid operators, and energy communities. We eliminate silos and incompatible formats.'
  },
  {
    icon: 'business' as IconName,
    title: 'Verifiable Business Models',
    copy: 'Usage policies, smart contracts, and pay-per-execution models. A distributed ledger ensures full traceability and automatic settlement.'
  },
  {
    icon: 'governance' as IconName,
    title: 'Granular Governance',
    copy: 'Revocable permissions and access traceability. Precise control over who accesses which data, under what conditions, and for what purpose.'
  }
]

function Standards(): ReactElement {
  return (
    <section className={styles.standards}>
      <div className={styles.sectionContainer}>
        <div className={styles.sectionHeading}>
          <h2>Platform Standards</h2>
          <span />
        </div>
        <div className={styles.standardsGrid}>
          {standards.map((standard) => (
            <article className={styles.standardCard} key={standard.title}>
              <span className={styles.standardIcon}>
                <Icon name={standard.icon} />
              </span>
              <h3>{standard.title}</h3>
              <p>{standard.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ComputeToData(): ReactElement {
  return (
    <section className={styles.computeSection}>
      <div className={`${styles.sectionContainer} ${styles.computeGrid}`}>
        <div className={styles.computeContent}>
          <div className={styles.securityBadge}>
            <Icon name="security" />
            Secure Execution
          </div>
          <h2>Privacy Preserved through Compute-to-Data.</h2>
          <p>
            Compute-to-Data executes advanced algorithms directly on source
            datasets, eliminating the need to transfer sensitive information. It
            securely processes private data in a controlled environment and
            returns only final results, like metrics or trained AI models. This
            guarantees absolute data sovereignty and regulatory compliance,
            enabling advanced energy optimization without ever exposing
            individual consumption data.
          </p>
          <ul className={styles.checkList}>
            <li>
              <Icon name="check" />
              <span>
                Advanced analytics without exposing sensitive consumption
                patterns.
              </span>
            </li>
            <li>
              <Icon name="check" />
              <span>
                Machine learning model training on distributed, private energy
                datasets.
              </span>
            </li>
          </ul>
        </div>
        <div className={styles.computeImageFrame}>
          <img
            src={computeImage}
            alt="Compute-to-Data securely processing distributed energy data"
          />
        </div>
      </div>
    </section>
  )
}

function Vision(): ReactElement {
  return (
    <section className={styles.visionSection}>
      <div className={`${styles.sectionContainer} ${styles.visionGrid}`}>
        <div className={styles.visionImageFrame}>
          <img
            src={visionImage}
            alt="A sustainable smart city and intelligent energy ecosystem"
          />
        </div>
        <div className={styles.visionContent}>
          <span className={styles.eyebrow}>Our Vision</span>
          <h2>Accelerating the Energy Transition.</h2>
          <p className={styles.visionLead}>
            Empower-X is a lighthouse data space ecosystem specialized in
            intelligent energy systems, enabling a federated and secure
            environment for the entire energy and smart city ecosystem.
          </p>
          <p>
            Our objective is to validate a data space aligned with European
            principles of data sovereignty, decentralised governance and
            cross-territorial interoperability. By enabling secure data
            exchange, we empower local energy markets to scale across borders
            while maintaining strict compliance with evolving regulations.
          </p>
        </div>
      </div>
    </section>
  )
}

function TrustFramework(): ReactElement {
  return (
    <section className={styles.trustSection}>
      <div className={`${styles.sectionContainer} ${styles.trustInner}`}>
        <p>Global Ecosystem Trust Framework</p>
        <div className={styles.trustMarks}>
          <span className={styles.lighthouseMark}>
            <img
              src="/images/lighthouse.png"
              alt="Gaia-X Lighthouse"
              width="3431"
              height="2790"
            />
          </span>
          <span>
            <Icon name="ready" /> GAIA-X
          </span>
          <span className={styles.oceanMark}>≋ OCEAN</span>
          <span>
            <Icon name="ssi" /> SSI TRUST
          </span>
        </div>
      </div>
    </section>
  )
}

export default function EmpowerHome(): ReactElement {
  return (
    <div className={styles.empowerHome}>
      <EmpowerHeader />
      <Hero />
      <QuickStart />
      <Standards />
      <ComputeToData />
      <Vision />
      <TrustFramework />
    </div>
  )
}
