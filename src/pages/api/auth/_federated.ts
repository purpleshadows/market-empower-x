import { federatedOidcIssuers } from 'app.config.cjs'

function getIssuerList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [value]
  }
}

export function isFederatedSource(loginSource: string): boolean {
  const normalizedLoginSource = loginSource.trim().toLowerCase()
  if (!normalizedLoginSource) return false

  return getIssuerList(federatedOidcIssuers).some((issuer: unknown) => {
    if (typeof issuer !== 'string') return false
    const normalizedIssuer = issuer.trim().toLowerCase()
    return (
      normalizedIssuer.length > 0 &&
      normalizedLoginSource.includes(normalizedIssuer)
    )
  })
}
