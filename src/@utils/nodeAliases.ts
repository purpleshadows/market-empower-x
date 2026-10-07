import { nodeUriAliases } from '../../app.config.cjs'

// A node can be reachable under more than one public name (e.g. it moved from
// node.zdevutils.com to node.empower-x.io). Assets keep the service URL they
// were published with, so the market maps old names to the current one:
// catalog queries still match the old name, and every loaded asset is rewritten
// to use the current name for downloads, compute and policy-server calls.

function normalizeUri(uri: string): string {
  return uri.trim().replace(/\/+$/, '')
}

const aliasToCanonical: Record<string, string> = Object.fromEntries(
  Object.entries((nodeUriAliases as Record<string, unknown>) || {})
    .filter(([, value]) => typeof value === 'string')
    .map(([alias, canonical]) => [
      normalizeUri(alias),
      normalizeUri(canonical as string)
    ])
)

/** The current name for a node URL (unchanged when it isn't an alias). */
export function getCanonicalNodeUri(uri?: string): string | undefined {
  if (!uri) return uri
  return aliasToCanonical[normalizeUri(uri)] || uri
}

/**
 * The given node URLs plus every old name that maps to one of them, with and
 * without a trailing slash (assets store both forms).
 */
export function withNodeAliases(uris: string[]): string[] {
  const canonical = new Set(uris.map(normalizeUri))
  const all = new Set<string>()
  uris.forEach((uri) => all.add(uri))
  Object.entries(aliasToCanonical).forEach(([alias, target]) => {
    if (canonical.has(target)) {
      all.add(alias)
      all.add(`${alias}/`)
    }
  })
  return Array.from(all)
}

/** Rewrites the service URLs of a loaded asset to the node's current name. */
export function applyNodeAliases<T>(asset: T): T {
  const services = (
    asset as {
      credentialSubject?: { services?: { serviceEndpoint?: string }[] }
    }
  )?.credentialSubject?.services
  if (!Array.isArray(services) || Object.keys(aliasToCanonical).length === 0)
    return asset

  let changed = false
  const rewritten = services.map((service) => {
    const canonical = getCanonicalNodeUri(service?.serviceEndpoint)
    if (!service || canonical === service.serviceEndpoint) return service
    changed = true
    return { ...service, serviceEndpoint: canonical }
  })
  if (!changed) return asset

  const typed = asset as unknown as { credentialSubject: object }
  return {
    ...typed,
    credentialSubject: { ...typed.credentialSubject, services: rewritten }
  } as unknown as T
}
