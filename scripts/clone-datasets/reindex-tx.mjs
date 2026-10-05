/**
 * Admin helper to ask the Ocean node to reindex one existing transaction.
 *
 * This does not create a blockchain transaction or spend gas. It only calls the
 * node admin/direct command API with your existing admin wallet signature.
 *
 * Usage:
 *   $env:TX = "0x..."
 *   node reindex-tx.mjs
 */

import { readFile } from 'node:fs/promises'
import {
  getBytes,
  hexlify,
  JsonRpcProvider,
  solidityPackedKeccak256,
  toUtf8Bytes,
  Wallet
} from 'ethers'
import { ProviderInstance } from '@oceanprotocol/lib'

// Chain the tx lives on. Default Optimism Sepolia; set CHAIN_ID=11155111 for Sepolia.
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 11155420)
const DEFAULT_NODE_URL = 'https://node.zdevutils.com'
const COMMAND = 'reindexTx'

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

function authMessage({ address, nonce, command }) {
  return String(address) + String(nonce) + String(command)
}

function hashAuthMessage(message) {
  return solidityPackedKeccak256(['bytes'], [hexlify(toUtf8Bytes(message))])
}

async function signedParams(nodeUrl, wallet, command, signatureVariant) {
  const address = await wallet.getAddress()
  const nonce = (await ProviderInstance.getNonce(nodeUrl, address)) + 1
  const message = authMessage({ address, nonce: nonce.toString(), command })
  const hash = hashAuthMessage(message)
  const signature =
    signatureVariant === 'hashBytes'
      ? await wallet.signMessage(getBytes(hash))
      : await wallet.signMessage(hash)
  return { address, nonce: nonce.toString(), signature }
}

async function postDirectCommand(nodeUrl, body) {
  const res = await fetch(`${nodeUrl.replace(/\/+$/, '')}/directCommand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, ok: res.ok, body: json }
}

async function main() {
  const repoEnv = await readRepoEnv()
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) throw new Error('Set PRIVATE_KEY in this PowerShell session.')

  const tx = process.env.TX
  if (!tx) throw new Error('Set TX to the setMetadata transaction hash.')

  const nodeUrl = process.env.NODE_URL || DEFAULT_NODE_URL
  const nodeUriMap = parseJsonObject(repoEnv.NEXT_PUBLIC_NODE_URI_MAP)
  const rpcUrl = process.env.RPC_URL || nodeUriMap?.[String(CHAIN_ID)]
  if (!rpcUrl) throw new Error('No RPC_URL or NEXT_PUBLIC_NODE_URI_MAP found.')

  const wallet = new Wallet(privateKey, new JsonRpcProvider(rpcUrl))
  const receipt = await wallet.provider.getTransactionReceipt(tx)
  if (!receipt) throw new Error(`No receipt found for ${tx}`)

  const signatures = [
    {
      name: 'keccak(address+nonce+command) as hex string',
      variant: 'hashString'
    },
    {
      name: 'keccak(address+nonce+command) as bytes',
      variant: 'hashBytes'
    }
  ]

  const payloads = [
    { chainId: CHAIN_ID, txId: tx },
    { chainId: String(CHAIN_ID), txId: tx }
  ]

  console.log(`Node: ${nodeUrl}`)
  console.log(`Wallet: ${await wallet.getAddress()}`)
  console.log(`Tx: ${tx}`)
  console.log(`Block: ${receipt.blockNumber}`)

  for (const signatureVariant of signatures) {
    const auth = await signedParams(
      nodeUrl,
      wallet,
      COMMAND,
      signatureVariant.variant
    )
    for (const payload of payloads) {
      const candidate = { command: COMMAND, ...auth, ...payload }
      const label = Object.keys(candidate)
      .filter((key) => !['signature', 'nonce', 'address', 'command'].includes(key))
      .map((key) => `${key}=${candidate[key]}`)
      .join(', ')
      const result = await postDirectCommand(nodeUrl, candidate)
      console.log(`\nSignature: ${signatureVariant.name}`)
      console.log(`Payload: ${label}`)
      console.log(`Status: ${result.status}`)
      console.log(JSON.stringify(result.body, null, 2))
      if (result.ok) return
    }
  }
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err)
  process.exit(1)
})
