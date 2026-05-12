/**
 * Refresh the access token this many milliseconds before its server-reported
 * expiry. 60s gives clock-skew tolerance and absorbs transient network errors
 * without the user ever seeing an expired session.
 */
export const REFRESH_LEAD_MS = 60_000

/**
 * On a transient failure (network error, 5xx) retry after this delay instead
 * of giving up or re-arming on the original expiry timeline. Bounded retries
 * keep us from hammering an unhealthy auth server.
 */
export const RETRY_DELAY_MS = 30_000

/**
 * How often we ask the BFF whether the session is still valid while the user
 * has a tab open. Picks up server-side revocations (deactivation, logout
 * elsewhere) without waiting for the natural refresh cycle.
 */
export const SESSION_POLL_INTERVAL_MS = 120_000

/**
 * Fired in the browser when a session verification request proves that a
 * previously known local session no longer exists on the server.
 */
export const AUTH_SESSION_LOST_EVENT = 'auth:session-lost'

export const DEFINITIVE_REFRESH_FAILURE_STATUSES = new Set([400, 401, 403])

/**
 * SessionStorage key for OIDC logout state management.
 */
export const OIDC_LOGOUT_PENDING_KEY = 'oidc_logout_pending'

/**
 * Enterprise fee collector contract ABI for token validation.
 */
export const ENTERPRISE_FEE_COLLECTOR_ABI = [
  'function isTokenAllowed(address) view returns (bool)'
]

/**
 * Timeout for token check operations on the blockchain.
 */
export const TOKEN_CHECK_TIMEOUT_MS = 5000
