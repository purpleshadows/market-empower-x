import { ReactElement } from 'react'
import styles from '../Bookmarks.module.css'

const SKELETON_ROWS = 10

export default function BookmarksSkeleton(): ReactElement {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={`${styles.skeletonRow} ${styles.skeletonHeaderRow}`}>
        <span className={styles.skeletonSquare} />
        <span />
        <span className={styles.skeletonHeaderCell} />
        <span className={styles.skeletonHeaderCell} />
        <span className={styles.skeletonHeaderCell} />
        <span className={styles.skeletonHeaderCell} />
        <span className={styles.skeletonHeaderCell} />
        <span />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
        <div
          className={styles.skeletonRow}
          key={`bookmark-skeleton-${rowIndex}`}
        >
          <span className={styles.skeletonSquare} />
          <span />
          <span className={styles.skeletonCell} />
          <span className={styles.skeletonCell} />
          <span className={styles.skeletonCell} />
          <span className={styles.skeletonCell} />
          <span className={styles.skeletonCell} />
          <span className={styles.skeletonSquare} />
        </div>
      ))}
    </div>
  )
}
