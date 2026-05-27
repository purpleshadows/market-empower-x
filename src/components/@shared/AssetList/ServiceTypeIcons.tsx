import { ReactElement } from 'react'
import Tooltip from '@shared/atoms/Tooltip'
import ServiceTypeIcon from '@shared/ServiceTypeIcon'
import { Service } from 'src/@types/ddo/Service'
import styles from './ServiceTypeIcons.module.css'

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
    return <span className={styles.empty}>-</span>
  }

  return (
    <div
      className={styles.serviceTypes}
      role="img"
      aria-label={getServiceTypesLabel(hasDownload, hasCompute)}
    >
      {hasDownload && (
        <ServiceTypeIcon type="access" className={styles.serviceIcon} />
      )}
      {hasCompute && (
        <ServiceTypeIcon type="compute" className={styles.serviceIcon} />
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
              <ServiceTypeIcon
                type="access"
                className={styles.serviceIcon}
                ariaHidden={false}
              />
              Has services of type access
            </span>
            <span className={styles.serviceLegendRow}>
              <ServiceTypeIcon
                type="compute"
                className={styles.serviceIcon}
                ariaHidden={false}
              />
              Has services of type compute
            </span>
          </div>
        }
      />
    </span>
  )
}
