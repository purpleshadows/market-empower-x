import { AssetExtended } from 'src/@types/AssetExtended'

// Friendly source names keyed by the node host an asset is served from. The
// catalog federates several OE nodes (see cross-node federation), so an asset's
// origin is otherwise only visible as a bare "node" hostname.
const PROVIDER_LABEL_BY_HOST: Record<string, string> = {
  'node.empower-x.io': 'Empower-X',
  'node.zdevutils.com': 'Empower-X',
  'node.demo.pontus-x.eu': 'SENSE'
}

/**
 * Friendly source label for a provider/service URL, or undefined when the host
 * isn't a recognised node. The `/pontusx` path is the v4 bridge.
 */
export function getProviderLabel(providerUrl?: string): string | undefined {
  if (!providerUrl) return undefined
  if (/\/pontusx\/?$/.test(providerUrl)) return 'external-pontus-x'
  const host = providerUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return PROVIDER_LABEL_BY_HOST[host]
}

/**
 * Always returns a label (falls back to the first hostname segment) — used by
 * the catalog filter where every listed provider needs a display name.
 */
export function formatProviderLabel(providerUrl: string): string {
  const known = getProviderLabel(providerUrl)
  if (known) return known

  const providerWithoutProtocol = providerUrl.replace(/^https?:\/\//, '')
  const firstDotIndex = providerWithoutProtocol.indexOf('.')
  return firstDotIndex > 0
    ? providerWithoutProtocol.slice(0, firstDotIndex)
    : providerWithoutProtocol.slice(0, 10)
}

/** The friendly source label for an asset, from its first service endpoint. */
export function getAssetSourceLabel(asset: AssetExtended): string | undefined {
  return getProviderLabel(
    asset?.credentialSubject?.services?.[0]?.serviceEndpoint
  )
}
