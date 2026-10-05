// Dual v4/v5 support.
//
// A "bridged v4 asset" is a standard-Ocean (DDO v4) asset — e.g. a Pontus-X
// dataset — that the aquarius v4 bridge wrapped into v5 shape so it lists in
// this Ocean Enterprise marketplace alongside native v5 assets. The bridge's
// `wrapDdoV4toV5` stamps markers that let the consume flow do the right thing
// for these assets: the plain v4 order + the asset's REAL v4 provider, and NO
// SSI/VC credential gate (that's a v5-only concept).
//
// Native v5 assets have none of these markers, so every helper here is a no-op
// for them and the existing v5 flow is unaffected.

interface BridgedV4Info {
  additionalInformation?: {
    sourceDdoVersion?: string
    sourceDid?: string
  }
}

/** True when the asset is a v4 DDO bridged into this v5 market. */
export function isBridgedV4Asset(asset: unknown): boolean {
  const info = (asset as { credentialSubject?: { metadata?: BridgedV4Info } })
    ?.credentialSubject?.metadata?.additionalInformation
  return info?.sourceDdoVersion === '4.1.0'
}

/**
 * The DID the v4 provider actually knows this asset by (`did:op:…`). The bridge
 * preserves it; otherwise we convert the visible `did:ope:` id back.
 */
export function getV4SourceDid(asset: unknown): string | undefined {
  const a = asset as {
    id?: string
    credentialSubject?: { metadata?: BridgedV4Info }
  }
  const marked =
    a?.credentialSubject?.metadata?.additionalInformation?.sourceDid
  if (marked) return marked
  const id = a?.id
  return id?.startsWith('did:ope:')
    ? 'did:op:' + id.slice('did:ope:'.length)
    : id
}

/**
 * The service's real v4 provider endpoint. The bridge rewrote the visible
 * `serviceEndpoint` to its proxy (for the node filter), but stashed the
 * original here so downloads reach the asset's actual provider.
 */
export function getV4ProviderUrl(service: unknown): string | undefined {
  const s = service as {
    originalServiceEndpoint?: string
    serviceEndpoint?: string
  }
  return s?.originalServiceEndpoint || s?.serviceEndpoint
}
