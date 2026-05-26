import { ReactElement } from 'react'
import AssetTeaserSkeleton from '@shared/AssetTeaser/Skeleton'
import styles from './index.module.css'

type AssetListSkeletonProps = {
  count?: number
  noPublisher?: boolean
  noDescription?: boolean
}

export default function AssetListSkeleton({
  count = 21,
  noPublisher,
  noDescription
}: AssetListSkeletonProps): ReactElement {
  const skeletonCount = Math.max(0, Math.floor(count))

  return (
    <div className={styles.assetList} aria-hidden="true">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <AssetTeaserSkeleton
          key={i}
          noPublisher={noPublisher}
          noDescription={noDescription}
        />
      ))}
    </div>
  )
}
