import { getRuntimeConfig } from '@utils/runtimeConfig'

export const getAuthMeta = () => {
  try {
    return JSON.parse(localStorage.getItem('auth_meta') || '{}')
  } catch {
    return {}
  }
}

const getFederatedIssuers = (): string[] => {
  try {
    const raw = getRuntimeConfig().NEXT_PUBLIC_FEDERATED_OIDC_ISSUERS
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is string => typeof s === 'string' && s.length > 0
    )
  } catch {
    return []
  }
}

export const isFederatedUser = (): boolean => {
  const issuers = getFederatedIssuers()
  if (issuers.length === 0) return false

  const upstream = (getAuthMeta()?.upstream_idp || '').toLowerCase()
  if (!upstream || upstream === 'unknown') return false

  return issuers.some((issuer) => upstream.includes(issuer.toLowerCase()))
}

export const getLogoutRedirect = () => {
  return `${window.location.origin}/auth/callback/logout`
}

export const clearFederatedStorage = () => {
  localStorage.removeItem('auth_meta')

  sessionStorage.removeItem('federated_oidc_session')
  sessionStorage.removeItem('federated_logout_timeout')
}

export const saveFederatedSessionData = () => {
  const oidcSession = localStorage.getItem('oidc_session')
  if (oidcSession) sessionStorage.setItem('federated_oidc_session', oidcSession)
}

export const restoreFederatedSessionData = () => {
  const savedSession = sessionStorage.getItem('federated_oidc_session')
  if (savedSession) localStorage.setItem('oidc_session', savedSession)
}
