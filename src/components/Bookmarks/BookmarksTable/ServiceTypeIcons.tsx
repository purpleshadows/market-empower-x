import { ReactElement } from 'react'
import Tooltip from '@shared/atoms/Tooltip'
import Download from '@images/download.svg'
import Compute from '@images/compute.svg'
import { Service } from 'src/@types/ddo/Service'
import styles from '../Bookmarks.module.css'

function getServiceTypesLabel(hasDownload: boolean, hasCompute: boolean) {
  if (hasDownload && hasCompute) return 'Access and compute services'
  if (hasDownload) return 'Access service'
  return 'Compute service'
}

export function ServiceTypeIcons({
  services
}: {
  services?: Service[]
}): ReactElement {
  const hasDownload = services?.some((service) => service.type === 'access')
  const hasCompute = services?.some((service) => service.type === 'compute')

  if (!hasDownload && !hasCompute) {
    return <span className={styles.serviceTypesEmpty}>-</span>
  }

  return (
    <div
      className={styles.serviceTypes}
      role="img"
      aria-label={getServiceTypesLabel(hasDownload, hasCompute)}
    >
      {hasDownload && (
        <Download aria-hidden="true" className={styles.serviceIcon} />
      )}
      {hasCompute && (
        <Compute aria-hidden="true" className={styles.serviceIcon} />
      )}
    </div>
  )
}

export function ServicesColumnHeader(): ReactElement {
  return (
    <span className={styles.servicesHeader}>
      Services
      <Tooltip
        placement="top"
        content={
          <div className={styles.serviceLegend}>
            <span className={styles.serviceLegendRow}>
              <Download
                role="img"
                aria-label="Download"
                className={styles.serviceIcon}
              />
              Has services of type access
            </span>
            <span className={styles.serviceLegendRow}>
              <Compute
                role="img"
                aria-label="Compute"
                className={styles.serviceIcon}
              />
              Has services of type compute
            </span>
          </div>
        }
      />
    </span>
  )
}
