import AssetTeaser from '@shared/AssetTeaser'
import { ReactElement } from 'react'
import Link from 'next/link'
import Pagination from '@shared/Pagination'
import Publisher from '@shared/Publisher'
import NetworkName from '@shared/NetworkName'
import styles from './index.module.css'
import Table, { TableOceanColumn } from '../atoms/Table'
import Price from '../Price'
import AssetType from '../AssetType'
import { getServiceByName } from '@utils/ddo'
import { AssetViewOptions } from './AssetViewSelector'
import Time from '../atoms/Time'
import { AssetExtended } from 'src/@types/AssetExtended'
import Alert from '../atoms/Alert'
import AssetListSkeleton, { AssetListTableSkeleton } from './Skeleton'

const columns: TableOceanColumn<AssetExtended>[] = [
  {
    name: 'Asset',
    selector: (row) => {
      const name = row.credentialSubject?.metadata?.name
      const owner = row.indexedMetadata?.nft?.owner
      return (
        <div className={styles.listDatasetCell}>
          <Link href={`/asset/${row.id}`} className={styles.listAssetName}>
            {name || row.id}
          </Link>
          {owner && (
            <span className={styles.listPublisher}>
              <Publisher account={owner} minimal />
            </span>
          )}
        </div>
      )
    },
    grow: 2,
    minWidth: '12rem'
  },
  {
    name: 'Type',
    selector: (row) => {
      const metadata = row.credentialSubject?.metadata
      const isCompute = Boolean(getServiceByName(row, 'compute'))
      return (
        <AssetType
          type={metadata?.type}
          accessType={isCompute ? 'compute' : 'access'}
        />
      )
    },
    maxWidth: '10rem'
  },
  {
    name: 'Network',
    selector: (row) => (
      <NetworkName networkId={row.credentialSubject?.chainId} />
    ),
    maxWidth: '9rem'
  },
  {
    name: 'Price',
    selector: (row) => {
      const stat = row.indexedMetadata?.stats?.[0]
      return (
        <Price
          price={{
            value: Number(stat?.prices?.[0]?.price ?? 0),
            tokenSymbol: stat?.symbol ?? '',
            tokenAddress: stat?.datatokenAddress ?? ''
          }}
          size="small"
        />
      )
    },
    maxWidth: '8rem'
  },
  {
    name: 'Sales',
    selector: (row) => {
      const orders = row.indexedMetadata?.stats?.[0]?.orders
      return <span>{orders == null || orders < 0 ? '—' : orders}</span>
    },
    maxWidth: '6rem'
  },
  {
    name: 'Published',
    selector: (row) => <Time date={row.indexedMetadata?.nft?.created} />,
    maxWidth: '8rem'
  }
]

declare type AssetListProps = {
  assets: AssetExtended[]
  showPagination: boolean
  page?: number
  totalPages?: number
  isLoading?: boolean
  onPageChange?: React.Dispatch<React.SetStateAction<number>>
  className?: string
  noPublisher?: boolean
  noDescription?: boolean
  noPrice?: boolean
  defaultAssetView?: AssetViewOptions
  skeletonCount?: number
}

export default function AssetList({
  assets,
  showPagination,
  page,
  totalPages,
  isLoading,
  onPageChange,
  className,
  noPublisher,
  noDescription,
  noPrice,
  defaultAssetView,
  skeletonCount = 21
}: AssetListProps): ReactElement {
  const activeAssetView = defaultAssetView || AssetViewOptions.Grid

  // This changes the page field inside the query
  function handlePageChange(selected: number) {
    onPageChange(selected + 1)
  }

  const styleClasses = `${styles.assetList} ${className || ''}`

  if (isLoading) {
    return activeAssetView === AssetViewOptions.List ? (
      <AssetListTableSkeleton />
    ) : (
      <AssetListSkeleton
        count={skeletonCount}
        noPublisher={noPublisher}
        noDescription={noDescription}
      />
    )
  }

  if (!assets?.length || assets[0] === undefined) {
    return <Alert warning>No results found</Alert>
  }

  return (
    <>
      {activeAssetView === AssetViewOptions.List ? (
        <Table
          columns={columns}
          data={assets}
          pagination={false}
          paginationPerPage={assets.length}
          dense
        />
      ) : (
        <div className={styleClasses}>
          {assets.map((asset) => {
            if (asset?.indexedMetadata && asset?.credentialSubject) {
              return (
                <AssetTeaser
                  asset={asset}
                  key={asset.id}
                  noPublisher={noPublisher}
                  noDescription={noDescription}
                  noPrice={noPrice}
                />
              )
            }
            return null
          })}
        </div>
      )}
      {showPagination && (
        <Pagination
          totalPages={totalPages}
          currentPage={page}
          onChangePage={handlePageChange}
        />
      )}
    </>
  )
}
