/**
 * v4 aquarius bridge — HTTP server (transparent dual-dialect mode).
 *
 * Sits directly in front of the OE node so a single hostname
 * (node.zdevutils.com) serves BOTH dialects:
 *   - v5 traffic (your OE market: index op_ddo_v5.0.0 / 'order', did:ope:,
 *     provider endpoints, downloads, C2D, …) passes through byte-for-byte.
 *   - v4 traffic (standard Ocean markets: index op_ddo_v4.1.0, did:op:) is
 *     translated to/from v5 on the fly.
 *
 * Point node.zdevutils.com's reverse proxy at this (UPSTREAM=http://oe-node:8000).
 *
 *   UPSTREAM=http://oe-node:8000 PORT=8080 node bridge.mjs
 */
import { createServer, request as httpRequest } from 'node:http'
import {
  rewriteQueryV4toV5,
  flattenQueryResponse,
  flattenDdoV5toV4,
  didV4toV5,
  didV5toV4,
  rewriteQueryV5toV4,
  wrapQueryResponse,
  wrapDdoV4toV5,
  V5_INDEX
} from './transform.mjs'

const UPSTREAM = (process.env.UPSTREAM || 'http://oe-node:8000').replace(
  /\/+$/,
  ''
)
const upstreamHost = new URL(UPSTREAM)
const PORT = Number(process.env.PORT || 8080)

// Reverse direction: a path prefix on this same host that proxies to a foreign
// standard-Ocean (v4) node and up-converts its assets to v5 for your OE market.
const REVERSE_PREFIX = process.env.REVERSE_PREFIX || '/pontusx'
const REVERSE_UPSTREAM = (
  process.env.REVERSE_UPSTREAM || 'https://node.demo.pontus-x.eu'
).replace(/\/+$/, '')
// The URL your market knows this reverse "node" as (used as the wrapped assets'
// serviceEndpoint so they pass the market's node filter).
const REVERSE_SERVICE_ENDPOINT =
  process.env.REVERSE_SERVICE_ENDPOINT || 'https://node.zdevutils.com/pontusx'
const REVERSE_DATASPACE = process.env.REVERSE_DATASPACE || 'pontus-x'

const QUERY_PATHS = new Set([
  '/api/aquarius/assets/metadata/query',
  '/api/aquarius/assets/query'
])

// ---- helpers -------------------------------------------------------------

// Guarantee a single CORS origin header without clobbering one the node set.
function withCors(headers = {}) {
  const out = { ...headers }
  const hasOrigin = Object.keys(out).some(
    (k) => k.toLowerCase() === 'access-control-allow-origin'
  )
  if (!hasOrigin) out['Access-Control-Allow-Origin'] = '*'
  out['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  out['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  return out
}

function sendJson(res, status, body, extraHeaders = {}) {
  // If the response has already started (e.g. a streamed download that erred
  // mid-flight), we cannot send a JSON error — writeHead would throw
  // ERR_HTTP_HEADERS_SENT and crash the whole bridge process. Just tear the
  // socket down instead so the client sees an aborted transfer, not a 502.
  if (res.headersSent || res.writableEnded) {
    try {
      res.destroy()
    } catch (e) {}
    return
  }
  res.writeHead(
    status,
    withCors({ 'Content-Type': 'application/json', ...extraHeaders })
  )
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// A standard-Ocean (v4) metadata query is identified by its index. Your OE
// market always sets an index (op_ddo_v5.0.0, or 'order' for order history), so
// anything that isn't explicitly op_ddo_v4.1.0 — or that references
// credentialSubject — is treated as v5 and passed through untouched.
function isV4Query(q) {
  if (q && q.index) return q.index === 'op_ddo_v4.1.0'
  if (q && q.index === V5_INDEX) return false
  const s = JSON.stringify(q?.query || {})
  return !s.includes('credentialSubject')
}

function didFromPath(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length))
}

// Faithful streaming reverse proxy (preserves method, headers, binary body,
// status, streaming). Used for everything we don't translate.
function streamProxy(req, res, pathWithQuery) {
  const headers = { ...req.headers, host: upstreamHost.host }
  const upReq = httpRequest(
    {
      protocol: upstreamHost.protocol,
      hostname: upstreamHost.hostname,
      port: upstreamHost.port || 80,
      method: req.method,
      path: pathWithQuery,
      headers
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, withCors(upRes.headers))
      // If the upstream stream breaks mid-download (after headers are sent),
      // tear the client socket down rather than trying to write an error.
      upRes.on('error', () => res.destroy())
      upRes.pipe(res)
    }
  )
  upReq.on('error', (err) =>
    sendJson(res, 502, { error: 'bridge upstream error', detail: err.message })
  )
  // If the client disconnects (e.g. cancels a large download), stop pulling
  // from upstream so we don't leak sockets.
  res.on('close', () => upReq.destroy())
  req.pipe(upReq)
}

// Forward an already-buffered body (we consumed it to sniff the dialect) while
// still mirroring the upstream response faithfully.
function forwardBuffered(req, res, pathWithQuery, body) {
  const headers = { ...req.headers, host: upstreamHost.host }
  headers['content-length'] = Buffer.byteLength(body)
  const upReq = httpRequest(
    {
      protocol: upstreamHost.protocol,
      hostname: upstreamHost.hostname,
      port: upstreamHost.port || 80,
      method: req.method,
      path: pathWithQuery,
      headers
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, withCors(upRes.headers))
      upRes.pipe(res)
    }
  )
  upReq.on('error', (err) =>
    sendJson(res, 502, { error: 'bridge upstream error', detail: err.message })
  )
  upReq.end(body)
}

// ---- request handlers ----------------------------------------------------

async function handleQuery(req, res, pathWithQuery) {
  const body = await readBody(req)
  let query
  try {
    query = body.length ? JSON.parse(body.toString()) : {}
  } catch {
    // Not JSON we understand — just proxy it through.
    return forwardBuffered(req, res, pathWithQuery, body)
  }

  if (!isV4Query(query)) {
    // v5 (OE market) — passthrough untouched.
    return forwardBuffered(req, res, pathWithQuery, body)
  }

  // v4 (standard market) — translate to v5, flatten the result back to v4.
  const v5Query = rewriteQueryV4toV5(query)
  const upstream = await fetch(`${UPSTREAM}/api/aquarius/assets/metadata/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v5Query)
  })
  const data = await upstream.json()
  return sendJson(res, upstream.status, flattenQueryResponse(data))
}

async function handleDdo(req, res, did, url, { metadataOnly = false } = {}) {
  // did:ope: (v5 client) -> passthrough; did:op: (v4 client) -> translate.
  if (!did.startsWith('did:op:')) {
    return streamProxy(req, res, url.pathname + url.search)
  }
  const upstream = await fetch(
    `${UPSTREAM}/api/aquarius/assets/ddo/${encodeURIComponent(didV4toV5(did))}`
  )
  if (upstream.status !== 200) {
    return sendJson(res, upstream.status, await upstream.text())
  }
  const v4 = flattenDdoV5toV4(await upstream.json())
  return sendJson(res, 200, metadataOnly ? v4.metadata : v4)
}

// ---- reverse direction (/pontusx -> foreign v4 node -> wrapped as v5) -----

async function handleReverse(req, res, url) {
  const inner = url.pathname.slice(REVERSE_PREFIX.length) || '/'
  const wrapOpts = {
    dataspace: REVERSE_DATASPACE,
    serviceEndpoint: REVERSE_SERVICE_ENDPOINT
  }

  if (inner === '/bridge/health') {
    return sendJson(res, 200, { status: 'ok', mode: 'reverse', upstream: REVERSE_UPSTREAM })
  }

  if (req.method === 'POST' && QUERY_PATHS.has(inner)) {
    const body = await readBody(req)
    let query
    try {
      query = body.length ? JSON.parse(body.toString()) : {}
    } catch {
      return sendJson(res, 400, { error: 'invalid JSON body' })
    }
    const { query: v4Query, dataspace } = rewriteQueryV5toV4(query)
    let upstream
    try {
      upstream = await fetch(`${REVERSE_UPSTREAM}/api/aquarius/assets/metadata/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v4Query),
        signal: AbortSignal.timeout(15000)
      })
    } catch {
      // Fail-open: if the foreign node is unreachable, show nothing from it
      // rather than breaking the whole catalog query.
      return sendJson(res, 200, { results: [], totalResults: 0, aggregations: {} })
    }
    const data = await upstream.json()
    return sendJson(
      res,
      upstream.status,
      wrapQueryResponse(data, { ...wrapOpts, dataspace: dataspace || REVERSE_DATASPACE })
    )
  }

  const ddoPrefix = '/api/aquarius/assets/ddo/'
  const metaPrefix = '/api/aquarius/assets/metadata/'
  if (req.method === 'GET' && (inner.startsWith(ddoPrefix) || inner.startsWith(metaPrefix))) {
    const metadataOnly = inner.startsWith(metaPrefix)
    const did = decodeURIComponent(
      inner.slice((metadataOnly ? metaPrefix : ddoPrefix).length)
    )
    const upstream = await fetch(
      `${REVERSE_UPSTREAM}/api/aquarius/assets/ddo/${encodeURIComponent(didV5toV4(did))}`
    )
    if (upstream.status !== 200) {
      return sendJson(res, upstream.status, await upstream.text())
    }
    const wrapped = wrapDdoV4toV5(await upstream.json(), wrapOpts)
    return sendJson(res, 200, metadataOnly ? wrapped.credentialSubject.metadata : wrapped)
  }

  // Best-effort passthrough for any other GET on the foreign node.
  if (req.method === 'GET') {
    try {
      const upstream = await fetch(`${REVERSE_UPSTREAM}${inner}${url.search}`)
      const text = await upstream.text()
      res.writeHead(
        upstream.status,
        withCors({ 'Content-Type': upstream.headers.get('content-type') || 'application/json' })
      )
      return res.end(text)
    } catch (err) {
      return sendJson(res, 502, { error: 'reverse upstream error', detail: err.message })
    }
  }
  return sendJson(res, 404, { error: 'not found' })
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, withCors())
      return res.end()
    }

    const url = new URL(req.url, `http://localhost:${PORT}`)
    const p = url.pathname

    // Reverse direction: /pontusx/* -> foreign v4 node, wrapped back to v5.
    if (p === REVERSE_PREFIX || p.startsWith(REVERSE_PREFIX + '/')) {
      return await handleReverse(req, res, url)
    }

    if (p === '/bridge/health') {
      return sendJson(res, 200, { status: 'ok', bridge: 'v4<->v5', upstream: UPSTREAM })
    }

    if (req.method === 'POST' && QUERY_PATHS.has(p)) {
      return await handleQuery(req, res, p)
    }

    if (req.method === 'GET' && p.startsWith('/api/aquarius/assets/ddo/')) {
      return await handleDdo(
        req,
        res,
        didFromPath(p, '/api/aquarius/assets/ddo/'),
        url
      )
    }

    if (req.method === 'GET' && p.startsWith('/api/aquarius/assets/metadata/')) {
      return await handleDdo(
        req,
        res,
        didFromPath(p, '/api/aquarius/assets/metadata/'),
        url,
        { metadataOnly: true }
      )
    }

    // Everything else (provider endpoints, downloads, C2D, node info, did:ope
    // lookups, state, …) is proxied through faithfully.
    return streamProxy(req, res, url.pathname + url.search)
  } catch (err) {
    sendJson(res, 502, { error: 'bridge error', detail: err.message })
  }
})

server.listen(PORT, () => {
  console.log(`v4<->v5 bridge (transparent) listening on :${PORT} -> ${UPSTREAM}`)
})
