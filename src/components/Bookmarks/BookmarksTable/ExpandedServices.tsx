import { ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoggerInstance } from '@oceanprotocol/lib'
import Price from '@shared/Price'
import { useCancelToken } from '@hooks/useCancelToken'
import {
  getAccessDetails,
  getAvailablePrice
} from '@utils/accessDetailsAndPricing'
import { secondsToString } from '@utils/ddo'
import Download from '@images/download.svg'
import Compute from '@images/compute.svg'
import BranchArrow from '@images/arrow_branch.svg'
import { AssetPrice } from 'src/@types/AssetPrice'
import { AssetExtended } from 'src/@types/AssetExtended'
import styles from '../Bookmarks.module.css'

export default function ExpandedServices({
  data
}: {
  data: AssetExtended
}): ReactElement {
  const services = data.credentialSubject?.services || []
  const newCancelToken = useCancelToken()

  const { data: prices } = useQuery({
    queryKey: ['bookmarkServicePrices', data.id],
    queryFn: async () => {
      const chainId = data.credentialSubject?.chainId
      const accessDetails = await Promise.all(
        services.map(async (service) => {
          try {
            return await getAccessDetails(
              chainId,
              service,
              '',
              newCancelToken()
            )
          } catch (error) {
            LoggerInstance.error(
              'Bookmarks service price error:',
              error instanceof Error ? error.message : String(error)
            )
            return null
          }
        })
      )
      return accessDetails.map((detail) =>
        detail ? getAvailablePrice(detail) : ({} as AssetPrice)
      )
    },
    enabled: services.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })

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
        {services.map((service, index) => {
          const isCompute = service.type === 'compute'
          const TypeIcon = isCompute ? Compute : Download

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
                {prices ? (
                  <Price price={prices[index]} size="small" />
                ) : (
                  <span className={styles.pricePending} aria-hidden="true" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
