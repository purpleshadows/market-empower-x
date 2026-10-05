/**
 * Read-only helper for diagnosing why a published asset did not index.
 *
 * Usage:
 *   $env:DID = "did:op:..."
 *   $env:NFT = "0x..."
 *   $env:TX = "0x..."
 *   node diagnose-indexing.mjs
 */

import { readFile } from 'node:fs/promises'
import { JsonRpcProvider, Wallet } from 'ethers'
import { ProviderInstance } from '@oceanprotocol/lib'

const CHAIN_ID = 11155111
const DEFAULT_PROVIDER_URL = 'https://node.zdevutils.com'

async function readRepoEnv() {
  const env = {}
  try {
    const txt = await readFile(new URL('../../.env', import.meta.url), 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let value = m[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[m[1]] = value
    }
  } catch {}
  return env
}

function parseJsonObject(value) {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function compact(value, max = 500) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function chunkToText(chunk) {
  if (typeof chunk === 'string') return chunk
  if (chunk instanceof Uint8Array) return new TextDecoder().decode(chunk)
  if (chunk?.type === 'Buffer' && Array.isArray(chunk.data)) {
    return new TextDecoder().decode(new Uint8Array(chunk.data))
  }
  return JSON.stringify(chunk)
}

async function toText(value) {
  if (typeof value === 'string') return value
  if (value instanceof Uint8Array) return new TextDecoder().decode(value)
  if (value && typeof value[Symbol.asyncIterator] === 'function') {
    let text = ''
    for await (const chunk of value) {
      text += chunkToText(chunk)
    }
    return text
  }
  if (value?.getReader) {
    const reader = value.getReader()
    const chunks = []
    while (true) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      chunks.push(chunk)
    }
    const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new TextDecoder().decode(bytes)
  }
  return JSON.stringify(value)
}

async function normalizeLogs(value) {
  if (Array.isArray(value)) return value

  const text = await toText(value)
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed.logs)) return parsed.logs
    if (Array.isArray(parsed.results)) return parsed.results
    if (Array.isArray(parsed.data)) return parsed.data
    return [parsed]
  } catch {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return line
        }
      })
  }
}

async function fetchText(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  return { status: res.status, text }
}

async function printFetch(label, url, max = 1200) {
  try {
    const result = await fetchText(url)
    console.log(`${label}: ${result.status}`)
    if (result.status !== 404 && result.text) console.log(compact(result.text, max))
  } catch (err) {
    console.log(`${label}: ERROR ${err?.message || err}`)
  }
}

function findIndexerBlock(status, chainId) {
  const indexer = status?.indexer
  if (!Array.isArray(indexer)) return undefined
  const chain = indexer.find(
    (entry) =>
      String(entry?.chainId ?? entry?.network ?? entry?.id) === String(chainId) ||
      String(entry?.chainName ?? entry?.networkName ?? '').toLowerCase() === 'sepolia'
  )
  return chain?.lastIndexedBlock ?? chain?.block ?? chain?.lastBlock ?? chain
}

async function main() {
  const repoEnv = await readRepoEnv()
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) throw new Error('Set PRIVATE_KEY in this PowerShell session.')

  const did = process.env.DID
  const nft = process.env.NFT
  const tx = process.env.TX
  const jobId = process.env.JOB_ID
  if (!did && !nft && !tx) throw new Error('Set at least DID, NFT, or TX.')

  const nodeUrl = process.env.NODE_URL || DEFAULT_PROVIDER_URL
  const nodeUriMap = parseJsonObject(repoEnv.NEXT_PUBLIC_NODE_URI_MAP)
  const rpcUrl = process.env.RPC_URL || nodeUriMap?.[String(CHAIN_ID)]
  if (!rpcUrl) throw new Error('No RPC_URL or NEXT_PUBLIC_NODE_URI_MAP found.')

  const wallet = new Wallet(privateKey, new JsonRpcProvider(rpcUrl))
  const now = Date.now()
  const hours = Number(process.env.LOG_HOURS || 12)
  const startTime = String(now - hours * 60 * 60 * 1000)
  const endTime = String(now + 60 * 1000)

  console.log(`Node: ${nodeUrl}`)
  console.log(`Wallet: ${await wallet.getAddress()}`)
  try {
    const status = await ProviderInstance.getNodeStatus(nodeUrl)
    console.log(`Node version: ${status?.version || '(unknown)'}`)
    console.log(`Indexer block: ${compact(findIndexerBlock(status, CHAIN_ID), 800)}`)
  } catch (err) {
    console.log(`Node status: ERROR ${err?.message || err}`)
  }
  if (did) {
    const direct = await fetchText(`${nodeUrl}/api/aquarius/assets/ddo/${did}`)
    console.log(`DDO status: ${direct.status}`)
    if (direct.status !== 404) console.log(compact(direct.text, 1200))
    await printFetch(
      'DDO state by DID',
      `${nodeUrl}/api/aquarius/state/ddo?did=${encodeURIComponent(did)}`,
      2000
    )
  }
  if (nft) {
    await printFetch(
      'DDO state by NFT',
      `${nodeUrl}/api/aquarius/state/ddo?nft=${encodeURIComponent(nft)}`,
      2000
    )
  }
  if (tx) {
    const receipt = await wallet.provider.getTransactionReceipt(tx)
    console.log(
      `Tx receipt: status=${receipt?.status} block=${receipt?.blockNumber} logs=${receipt?.logs?.length}`
    )
    await printFetch(
      'DDO state by txId',
      `${nodeUrl}/api/aquarius/state/ddo?txId=${encodeURIComponent(tx)}`,
      2000
    )
  }

  const rawLogs = await ProviderInstance.downloadNodeLogs(
    nodeUrl,
    wallet,
    startTime,
    endTime,
    1000
  )
  const logs = await normalizeLogs(rawLogs)
  const needles = [did, nft, tx, jobId].filter(Boolean).map((v) => v.toLowerCase())
  const matches = logs.filter((entry) =>
    needles.some((needle) => JSON.stringify(entry).toLowerCase().includes(needle))
  )

  console.log(`Raw logs type: ${Object.prototype.toString.call(rawLogs)}`)
  if (rawLogs && typeof rawLogs === 'object' && !Array.isArray(rawLogs)) {
    console.log(`Raw logs keys: ${Object.keys(rawLogs).join(', ') || '(none)'}`)
  }
  console.log(`Logs scanned: ${logs.length}`)
  console.log(`Matching logs: ${matches.length}`)
  if (matches.length === 0) {
    console.log('Log response sample:')
    for (const entry of logs.slice(0, 5)) {
      console.log(compact(entry, 2000))
    }
  }
  for (const entry of matches.slice(-50)) {
    console.log(compact(entry, 2000))
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
