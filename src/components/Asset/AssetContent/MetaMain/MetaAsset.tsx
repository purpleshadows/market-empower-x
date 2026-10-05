import Publisher from '@shared/Publisher'
import { ReactElement } from 'react'
import styles from './MetaAsset.module.css'
import { AssetExtended } from 'src/@types/AssetExtended'
import { getAssetSourceLabel } from '@utils/assetSource'

export default function MetaAsset({
  asset
}: {
  asset: AssetExtended
}): ReactElement {
  const sourceLabel = getAssetSourceLabel(asset)

  return (
    <div className={styles.wrapper}>
      <span className={styles.owner}>
        Owned by <Publisher account={asset?.indexedMetadata?.nft?.owner} />
      </span>
      {sourceLabel && (
        <span
          className={styles.sourceBadge}
          data-source={sourceLabel}
          title={`Provided by ${sourceLabel}`}
        >
          {sourceLabel}
        </span>
      )}
    </div>
  )
}
