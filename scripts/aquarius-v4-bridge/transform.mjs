/**
 * Translation core for the v4 aquarius bridge.
 *
 * Your node (node.zdevutils.com) is an Ocean *Enterprise* node: it stores DDO v5
 * documents (everything wrapped under `credentialSubject`, DIDs `did:ope:…`,
 * indexed as `op_ddo_v5.0.0`). A standard Ocean Market (Pontus-X, etc.) speaks
 * DDO v4: flat `metadata`/`services`/`chainId`, DIDs `did:op:…`, index
 * `op_ddo_v4.1.0`.
 *
 * This module converts between the two:
 *   - rewriteQueryV4toV5(query)  : a v4 Elasticsearch query -> the v5 equivalent
 *   - flattenDdoV5toV4(asset)    : a v5 result document      -> a flat v4 DDO
 *   - didV4toV5(did) / didV5toV4 : did:op: <-> did:ope: (same 64-hex hash)
 *
 * The only structural differences between v4.1.0 and OE v5 are:
 *   1. index name                  (op_ddo_v4.1.0  vs  op_ddo_v5.0.0)
 *   2. the `credentialSubject.*` wrapper around metadata/services/chainId/…
 *   3. the DID prefix              (did:op:        vs  did:ope:)
 *   4. `credentialSubject.services` is a *nested* ES field in v5
 * `indexedMetadata.*` (nft/purgatory/stats/event) is identical in both, so it is
 * left untouched.
 */

export const V5_INDEX = 'op_ddo_v5.0.0'

// ---------------------------------------------------------------------------
// DID prefix mapping. The 64-hex hash is identical between schemes; only the
// prefix differs, so this is a clean, reversible swap.
// ---------------------------------------------------------------------------
export function didV4toV5(did) {
  return typeof did === 'string' && did.startsWith('did:op:')
    ? 'did:ope:' + did.slice('did:op:'.length)
    : did
}

export function didV5toV4(did) {
  return typeof did === 'string' && did.startsWith('did:ope:')
    ? 'did:op:' + did.slice('did:ope:'.length)
    : did
}

// ---------------------------------------------------------------------------
// Field-path mapping (v4 flat -> v5 credentialSubject-wrapped).
// Anything already under credentialSubject.* or indexedMetadata.* is left as-is.
// ---------------------------------------------------------------------------
const FIELD_MAP = [
  [/^chainId$/, 'credentialSubject.chainId'],
  [/^nftAddress\b/, 'credentialSubject.nftAddress'],
  [/^metadata\b/, 'credentialSubject.metadata'],
  [/^services\b/, 'credentialSubject.services'],
  [/^datatokens\b/, 'credentialSubject.datatokens'],
  [/^credentials\b/, 'credentialSubject.credentials']
]

function mapField(field) {
  if (typeof field !== 'string') return field
  if (
    field.startsWith('credentialSubject.') ||
    field.startsWith('indexedMetadata.') ||
    field === '_id' ||
    field === 'id' ||
    field === '_index'
  ) {
    return field
  }
  for (const [pattern, replacement] of FIELD_MAP) {
    if (pattern.test(field)) return field.replace(pattern, replacement)
  }
  return field
}

// DID-valued fields carry did:op: values that must become did:ope: for the node.
function mapValueForField(field, value) {
  if (field !== '_id' && field !== 'id') return value
  if (Array.isArray(value)) return value.map(didV4toV5)
  return didV4toV5(value)
}

const LEAF_QUERY_TYPES = ['term', 'terms', 'match', 'match_phrase', 'prefix', 'wildcard']

// Wrap a leaf that targets credentialSubject.services.* in a nested query, since
// services is a nested field in the v5 index.
function maybeNest(leaf, targetField) {
  return targetField && targetField.startsWith('credentialSubject.services.')
    ? { nested: { path: 'credentialSubject.services', query: leaf } }
    : leaf
}

function rewriteNode(node) {
  if (Array.isArray(node)) return node.map(rewriteNode)
  if (!node || typeof node !== 'object') return node

  // Leaf queries: { term: { field: value } }, { match: {…} }, …
  for (const qt of LEAF_QUERY_TYPES) {
    if (node[qt] && typeof node[qt] === 'object' && !Array.isArray(node[qt])) {
      const out = {}
      let serviceField = null
      for (const [field, value] of Object.entries(node[qt])) {
        const nf = mapField(field)
        out[nf] = mapValueForField(nf, value)
        if (nf.startsWith('credentialSubject.services.')) serviceField = nf
      }
      return maybeNest({ [qt]: out }, serviceField)
    }
  }

  // range: { range: { field: { gte: … } } }
  if (node.range && typeof node.range === 'object') {
    const out = {}
    let serviceField = null
    for (const [field, value] of Object.entries(node.range)) {
      const nf = mapField(field)
      out[nf] = value
      if (nf.startsWith('credentialSubject.services.')) serviceField = nf
    }
    return maybeNest({ range: out }, serviceField)
  }

  // exists: { exists: { field: "…" } }
  if (node.exists && typeof node.exists === 'object' && node.exists.field) {
    const nf = mapField(node.exists.field)
    return maybeNest({ exists: { field: nf } }, nf)
  }

  // Generic recurse. Two special keys carry field paths as *values*:
  //   - "field" inside aggregations / function sorts
  //   - "sort" whose object keys are field paths
  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'field' && typeof value === 'string') {
      out[key] = mapField(value)
    } else if (key === 'sort') {
      out[key] = rewriteSort(value)
    } else {
      out[key] = rewriteNode(value)
    }
  }
  return out
}

function rewriteSort(sort) {
  if (Array.isArray(sort)) return sort.map(rewriteSort)
  if (!sort || typeof sort !== 'object') return sort
  const out = {}
  for (const [field, dir] of Object.entries(sort)) {
    out[mapField(field)] = dir
  }
  return out
}

// Aggregations need their own walker: an aggregation's `terms`/`range`/… is an
// aggregation *type* (with a `field` key), not a leaf query, so rewriteNode's
// leaf logic must not touch it. Here we only rewrite `field` values, recurse
// into sub-aggregations, and translate real queries inside `filter`/`query` aggs.
function rewriteAggs(node) {
  if (Array.isArray(node)) return node.map(rewriteAggs)
  if (!node || typeof node !== 'object') return node
  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'field' && typeof value === 'string') {
      out[key] = mapField(value)
    } else if (key === 'query' || key === 'filter') {
      out[key] = rewriteNode(value)
    } else {
      out[key] = rewriteAggs(value)
    }
  }
  return out
}

/**
 * Rewrite a full standard-Ocean (v4) metadata query into the v5 equivalent the
 * Enterprise node understands.
 */
export function rewriteQueryV4toV5(query) {
  const q = query && typeof query === 'object' ? { ...query } : {}
  // Force the v5 index and drop any _source narrowing (which would strip the
  // credentialSubject wrapper we need in order to flatten the response).
  q.index = V5_INDEX
  delete q._source
  if (q.query) q.query = rewriteNode(q.query)
  if (q.aggs) q.aggs = rewriteAggs(q.aggs)
  if (q.aggregations) q.aggregations = rewriteAggs(q.aggregations)
  if (q.sort) q.sort = rewriteSort(q.sort)
  return q
}

// ---------------------------------------------------------------------------
// Response: v5 document -> flat v4 DDO.
// ---------------------------------------------------------------------------
function flattenMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata
  const out = { ...metadata }
  // v5 description is an i18n object { '@value', '@language', … }; v4 wants a string.
  if (out.description && typeof out.description === 'object') {
    out.description = out.description['@value'] ?? ''
  }
  if (out.name && typeof out.name === 'object') {
    out.name = out.name['@value'] ?? ''
  }
  return out
}

/**
 * Convert one v5 result document into the flat v4 shape a standard Ocean Market
 * expects. `indexedMetadata` is already identical between schemas.
 */
export function flattenDdoV5toV4(asset) {
  if (!asset || typeof asset !== 'object') return asset
  const cs = asset.credentialSubject || {}
  const flat = {
    '@context': ['https://w3id.org/did/v1'],
    id: didV5toV4(asset.id),
    version: '4.1.0',
    nftAddress: cs.nftAddress,
    chainId: cs.chainId,
    metadata: flattenMetadata(cs.metadata),
    services: cs.services,
    datatokens: cs.datatokens,
    credentials: cs.credentials,
    indexedMetadata: asset.indexedMetadata
  }
  // Some markets read stats from the top level; expose them harmlessly.
  if (cs.stats) flat.stats = cs.stats
  if (asset.indexedMetadata?.nft) flat.nft = asset.indexedMetadata.nft
  if (asset.indexedMetadata?.purgatory) {
    flat.purgatory = asset.indexedMetadata.purgatory
  }
  return flat
}

/**
 * Flatten a node metadata-query response, preserving its {results,totalResults,
 * aggregations} envelope (the node may also wrap it in a single-element array).
 */
export function flattenQueryResponse(data) {
  const envelope = Array.isArray(data) ? data[0] : data
  if (!envelope || typeof envelope !== 'object') return envelope
  const results = Array.isArray(envelope.results)
    ? envelope.results.map(flattenDdoV5toV4)
    : envelope.results
  return { ...envelope, results }
}

// ===========================================================================
// REVERSE direction: v5 query (your OE market) -> v4 (a standard node such as
// Pontus-X), and its flat v4 results wrapped back into v5 so your market renders
// them. Used by the bridge's /pontusx path.
// ===========================================================================

const DROP = Symbol('drop-filter')

const INV_FIELD_MAP = [
  [/^credentialSubject\.chainId\b/, 'chainId'],
  [/^credentialSubject\.nftAddress\b/, 'nftAddress'],
  [/^credentialSubject\.metadata\b/, 'metadata'],
  [/^credentialSubject\.services\b/, 'services'],
  [/^credentialSubject\.datatokens\b/, 'datatokens'],
  [/^credentialSubject\.credentials\b/, 'credentials'],
  [/^credentialSubject\.stats\b/, 'stats']
]

function invMapField(field) {
  if (typeof field !== 'string') return field
  if (
    field.startsWith('indexedMetadata.') ||
    field === '_id' ||
    field === 'id' ||
    field === '_index'
  ) {
    return field
  }
  for (const [pattern, replacement] of INV_FIELD_MAP) {
    if (pattern.test(field)) return field.replace(pattern, replacement)
  }
  if (field.startsWith('credentialSubject.')) {
    return field.slice('credentialSubject.'.length)
  }
  return field
}

// Filters that gate assets to *our* node — meaningless against a foreign node,
// so they're dropped before querying it (and re-applied when wrapping results).
function isServiceEndpointField(f) {
  return typeof f === 'string' && f.includes('services.serviceEndpoint')
}
function isDataspaceField(f) {
  return typeof f === 'string' && f.startsWith('credentialSubject.dataspace')
}

function mapDidValue(value, fn) {
  if (Array.isArray(value)) return value.map(fn)
  return fn(value)
}

function rewriteNodeV5toV4(node, ctx) {
  if (Array.isArray(node)) {
    return node.map((n) => rewriteNodeV5toV4(n, ctx)).filter((n) => n !== DROP)
  }
  if (!node || typeof node !== 'object') return node

  // Unwrap the nested services wrapper — v4 services is a flat field.
  if (
    node.nested &&
    typeof node.nested.path === 'string' &&
    node.nested.path.startsWith('credentialSubject.services')
  ) {
    return rewriteNodeV5toV4(node.nested.query, ctx)
  }

  for (const qt of LEAF_QUERY_TYPES) {
    if (node[qt] && typeof node[qt] === 'object' && !Array.isArray(node[qt])) {
      const field = Object.keys(node[qt])[0]
      if (isDataspaceField(field)) {
        const v = node[qt][field]
        ctx.dataspace = Array.isArray(v) ? v[0] : v
        return DROP
      }
      if (isServiceEndpointField(field)) return DROP
      const out = {}
      for (const [k, val] of Object.entries(node[qt])) {
        const nf = invMapField(k)
        out[nf] = nf === '_id' || nf === 'id' ? mapDidValue(val, didV5toV4) : val
      }
      return { [qt]: out }
    }
  }

  if (node.range && typeof node.range === 'object') {
    const field = Object.keys(node.range)[0]
    if (isServiceEndpointField(field) || isDataspaceField(field)) return DROP
    const out = {}
    for (const [k, val] of Object.entries(node.range)) out[invMapField(k)] = val
    return { range: out }
  }

  if (node.exists && node.exists.field) {
    if (isServiceEndpointField(node.exists.field) || isDataspaceField(node.exists.field)) {
      return DROP
    }
    return { exists: { field: invMapField(node.exists.field) } }
  }

  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'field' && typeof value === 'string') {
      out[key] = invMapField(value)
    } else if (key === 'sort') {
      out[key] = rewriteSortV5toV4(value)
    } else {
      const rw = rewriteNodeV5toV4(value, ctx)
      if (rw !== DROP) out[key] = rw
    }
  }
  return out
}

function rewriteSortV5toV4(sort) {
  if (Array.isArray(sort)) return sort.map(rewriteSortV5toV4)
  if (!sort || typeof sort !== 'object') return sort
  const out = {}
  for (const [field, dir] of Object.entries(sort)) out[invMapField(field)] = dir
  return out
}

function rewriteAggsV5toV4(node) {
  if (Array.isArray(node)) return node.map(rewriteAggsV5toV4)
  if (!node || typeof node !== 'object') return node
  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'field' && typeof value === 'string') out[key] = invMapField(value)
    else if (key === 'query' || key === 'filter') {
      const r = rewriteNodeV5toV4(value, { dataspace: null })
      out[key] = r === DROP ? { match_all: {} } : r
    } else out[key] = rewriteAggsV5toV4(value)
  }
  return out
}

/**
 * Rewrite a v5 (OE market) query into v4, dropping the node/dataspace gate
 * filters. Returns { query, dataspace } — dataspace is what the market asked
 * for, so wrapped results can be tagged with it and still match the view.
 */
export function rewriteQueryV5toV4(query) {
  const ctx = { dataspace: null }
  const q = query && typeof query === 'object' ? { ...query } : {}
  q.index = 'op_ddo_v4.1.0'
  delete q._source
  if (q.query) {
    const r = rewriteNodeV5toV4(q.query, ctx)
    q.query = r === DROP ? { match_all: {} } : r
  }
  if (q.aggs) q.aggs = rewriteAggsV5toV4(q.aggs)
  if (q.aggregations) q.aggregations = rewriteAggsV5toV4(q.aggregations)
  if (q.sort) q.sort = rewriteSortV5toV4(q.sort)
  return { query: q, dataspace: ctx.dataspace }
}

/**
 * Wrap a flat v4 DDO back into the v5 shape your OE market expects, tagging it
 * with the requested dataspace + our proxy serviceEndpoint so it passes the
 * market's node/dataspace filters and renders in the current view.
 */
export function wrapDdoV4toV5(asset, { dataspace = 'pontus-x', serviceEndpoint } = {}) {
  if (!asset || typeof asset !== 'object') return asset
  const services = Array.isArray(asset.services)
    ? asset.services.map((s) => ({
        ...s,
        // Preserve the real v4 provider so the market can consume against it —
        // the visible serviceEndpoint is rewritten to our proxy for the node
        // filter, but the download must reach the asset's actual provider.
        originalServiceEndpoint: s.serviceEndpoint,
        ...(serviceEndpoint ? { serviceEndpoint } : {}),
        // v4 services have no `state`; the OE market only renders services with
        // state === 0 (active), so default v4 services to 0.
        state: typeof s.state === 'number' ? s.state : 0
      }))
    : asset.services
  // Flag this as a bridged v4 asset and keep the original did:op, so the market
  // can pick the v4 consume flow (plain order + v4 provider, no SSI) and address
  // that provider by the DID it actually knows.
  const metadata =
    asset.metadata && typeof asset.metadata === 'object'
      ? {
          ...asset.metadata,
          additionalInformation: {
            ...(asset.metadata.additionalInformation || {}),
            sourceDdoVersion: '4.1.0',
            sourceDid: asset.id
          }
        }
      : asset.metadata
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: didV4toV5(asset.id),
    version: '5.0.0',
    type: ['VerifiableCredential'],
    credentialSubject: {
      chainId: asset.chainId,
      dataspace,
      nftAddress: asset.nftAddress,
      metadata,
      services,
      datatokens: asset.datatokens,
      credentials: asset.credentials,
      stats: asset.stats
    },
    indexedMetadata: asset.indexedMetadata
  }
}

export function wrapQueryResponse(data, opts) {
  const envelope = Array.isArray(data) ? data[0] : data
  if (!envelope || typeof envelope !== 'object') return envelope
  const results = Array.isArray(envelope.results)
    ? envelope.results.map((a) => wrapDdoV4toV5(a, opts))
    : envelope.results
  return { ...envelope, results }
}
