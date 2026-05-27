import { ReactElement } from 'react'
import Link from 'next/link'
import { TableOceanColumn } from '@shared/atoms/Table'
import AssetTitle from '@shared/AssetListTitle'
import AssetType from '@shared/AssetType'
import NetworkName from '@shared/NetworkName'
import Time from '@shared/atoms/Time'
import DeleteIcon from '@images/delete.svg'
import ExternalIcon from '@images/external.svg'
import { AssetExtended } from 'src/@types/AssetExtended'
import styles from '../Bookmarks.module.css'
import {
  ServiceTypeIcons,
  ServicesColumnHeader
} from '@shared/AssetList/ServiceTypeIcons'

export function buildBookmarkColumns(
  onRemove: (did: string) => void
): TableOceanColumn<AssetExtended>[] {
  return [
    {
      name: 'Name',
      cell: (row) => (
        <div className={styles.nameCell}>
          <AssetTitle
            title={row.credentialSubject.metadata.name}
            asset={row}
            openInNewTab
          />
          <Link
            className={styles.externalLink}
            href={`/asset/${row.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open asset in a new tab"
          >
            <ExternalIcon />
          </Link>
        </div>
      ),
      grow: 1
    },
    {
      name: 'Type',
      cell: (row) => (
        <AssetType
          className={styles.bookmarkType}
          type={row.credentialSubject.metadata.type}
          variant="metadata"
        />
      ),
      width: '140px'
    },
    {
      name: <ServicesColumnHeader />,
      cell: (row) => (
        <ServiceTypeIcons services={row.credentialSubject?.services} />
      ),
      width: '120px'
    },
    {
      name: 'Network',
      cell: (row) => (
        <NetworkName
          className={styles.bookmarkNetwork}
          networkId={row.credentialSubject?.chainId}
        />
      ),
      width: '240px'
    },
    {
      name: 'Published',
      cell: (row) =>
        row.indexedMetadata?.nft?.created ? (
          <Time date={row.indexedMetadata.nft.created} />
        ) : (
          '-'
        ),
      width: '110px',
      right: true
    },
    {
      name: '',
      cell: (row): ReactElement => (
        <button
          type="button"
          className={styles.removeButton}
          onClick={() => onRemove(row.id)}
          title="Remove bookmark"
          aria-label="Remove bookmark"
        >
          <DeleteIcon />
        </button>
      ),
      width: '3.5rem',
      right: true
    }
  ]
}
