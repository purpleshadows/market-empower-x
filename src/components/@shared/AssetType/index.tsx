import { ReactElement } from 'react'
import styles from './index.module.css'
import Dataset from '@images/dataset.svg'
import Algorithm from '@images/algorithm.svg'

export default function AssetType({
  type,
  className
}: {
  type: string
  className?: string
}): ReactElement {
  const isDataset = type === 'dataset'

  return (
    <div className={className || null}>
      {isDataset ? (
        <Dataset role="img" aria-label="Dataset" className={styles.icon} />
      ) : (
        <Algorithm role="img" aria-label="Algorithm" className={styles.icon} />
      )}
      <div className={styles.typeLabel}>
        {isDataset ? 'dataset' : 'algorithm'}
      </div>
    </div>
  )
}
