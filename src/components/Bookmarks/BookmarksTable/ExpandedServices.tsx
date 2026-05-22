import { ReactElement, useMemo } from 'react'
import { useMarketMetadata } from '@context/MarketMetadata'
import Price from '@shared/Price'
import { secondsToString } from '@utils/ddo'
import Download from '@images/download.svg'
import Compute from '@images/compute.svg'
import BranchArrow from '@images/arrow_branch.svg'
import { AssetPrice } from 'src/@types/AssetPrice'
import { AssetExtended } from 'src/@types/AssetExtended'
import { getServiceStats, resolveServiceTokenSymbol } from '@utils/priceToken'
import styles from '../Bookmarks.module.css'

function getServicePrice(
  asset: AssetExtended,
  serviceIndex: number,
  serviceId?: string,
  tokenSymbolMap?: Record<string, string>
): AssetPrice {
  const stat = getServiceStats(asset, serviceIndex, serviceId)
  const priceEntry = stat?.prices?.[0]
  const accessDetail =
    asset.accessDetails?.find(
      (detail) =>
        detail?.addressOrId &&
        priceEntry?.exchangeId &&
        detail?.addressOrId?.toLowerCase() ===
          priceEntry.exchangeId.toLowerCase()
    ) ||
    asset.accessDetails?.find(
      (detail) =>
        detail?.datatoken?.address &&
        stat?.datatokenAddress &&
        detail?.datatoken?.address?.toLowerCase() ===
          stat.datatokenAddress.toLowerCase()
    ) ||
    asset.accessDetails?.[serviceIndex]
  const offchainStat =
    asset.offchain?.stats?.services?.find(
      (service) => service?.serviceId === serviceId
    ) || asset.offchain?.stats?.services?.[serviceIndex]
  const offchainPriceEntry = offchainStat?.prices?.[0]
  const priceToken = priceEntry?.token
  const tokenAddress =
    accessDetail?.baseToken?.address ||
    offchainPriceEntry?.token?.address ||
    priceEntry?.baseToken?.address ||
    (typeof priceToken === 'string' ? priceToken : priceToken?.address) ||
    ''

  return {
    value: Number(
      accessDetail?.price ?? offchainPriceEntry?.price ?? priceEntry?.price ?? 0
    ),
    tokenSymbol:
      accessDetail?.baseToken?.symbol ||
      offchainPriceEntry?.token?.symbol ||
      resolveServiceTokenSymbol(
        asset,
        serviceIndex,
        serviceId,
        tokenSymbolMap
      ) ||
      stat?.price?.tokenSymbol ||
      '',
    tokenAddress
  }
}

export default function ExpandedServices({
  data
}: {
  data: AssetExtended
}): ReactElement {
  const { approvedBaseTokens } = useMarketMetadata()
  const services = data.credentialSubject?.services || []
  const tokenSymbolMap = useMemo(() => {
    const map: Record<string, string> = {}
    approvedBaseTokens?.forEach((token) => {
      if (!token?.address || !token?.symbol) return
      map[token.address.toLowerCase()] = token.symbol
    })
    return map
  }, [approvedBaseTokens])

  if (!services.length) {
    return (
      <div className={styles.expanded}>
        <div className={styles.servicesCard}>No services for this asset.</div>
      </div>
    )
  }

  return (
    <div className={styles.expanded}>
      <div className={styles.servicesCard}>
        <div className={styles.expandedHeader}>
          <div className={styles.expandedNameHeader}>Name</div>
          <div className={styles.expandedType}>Service type</div>
          <div className={styles.expandedDuration}>Duration</div>
          <div className={styles.expandedPrice}>Price</div>
        </div>
        {services.map((service, index) => {
          const isCompute = service.type === 'compute'
          const TypeIcon = isCompute ? Compute : Download
          const price = getServicePrice(data, index, service.id, tokenSymbolMap)

          return (
            <div
              className={styles.expandedRow}
              key={service.id || `service-${index}`}
            >
              <div className={styles.expandedName}>
                <BranchArrow
                  className={styles.branchArrow}
                  aria-hidden="true"
                />
                <span className={styles.serviceNameText} title={service.name}>
                  {service.name || `Service ${index + 1}`}
                </span>
              </div>
              <div className={styles.expandedType}>
                <TypeIcon
                  role="img"
                  aria-label={isCompute ? 'Compute' : 'Download'}
                  className={styles.serviceIcon}
                />
                {isCompute ? 'Compute' : 'Download'}
              </div>
              <div className={styles.expandedDuration}>
                {secondsToString(Number(service.timeout) || 0)}
              </div>
              <div className={styles.expandedPrice}>
                <Price price={price} size="small" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
