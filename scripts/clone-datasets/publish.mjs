/**
 * Bulk-publish datasets to the Ocean Enterprise marketplace (Sepolia).
 * ===================================================================
 *
 * Reads `datasets.json` (produced by `fetch-metadata.mjs`) and publishes each
 * entry that has a `sourceUrl` as an Ocean Enterprise **DDO v5** "access"
 * (download) asset — the same result you get by publishing through the
 * marketplace UI, but scripted for many datasets at once.
 *
 * WHY THIS FILE LOOKS THE WAY IT DOES
 * -----------------------------------
 * The on-chain format was reverse-engineered from an asset published through
 * the live marketplace, because the node only indexes assets shaped *exactly*
 * the way its signer-server produces them. The non-obvious requirements:
 *
 *   1. DID scheme is `did:ope:` (Enterprise v5), not the plain `did:op:`.
 *   2. The DDO is signed as a self-issued **ES256 / did:jwk** Verifiable
 *      Credential (what the marketplace "signer-server" does) — NOT an
 *      ETH-EIP191 wallet signature. The node can't decode the latter.
 *   3. Metadata is stored **unencrypted** (on-chain flags = 0) as an **IPFS
 *      pointer**: the DDO JWT goes to IPFS, and the chain only holds
 *      `{"remote":{"type":"ipfs","hash":"..."}}`. Because flags = 0 the node
 *      reads it directly and never calls back to itself to decrypt — which
 *      matters because this node cannot reach its own public URL (NAT
 *      hairpin), so any encrypted (flags = 2) asset fails to index.
 *   4. `metaDataHash` = `sha256(JSON.stringify(ipfsPayload))` — the hash of the
 *      exact JSON uploaded to IPFS.
 *   5. The DDO must NOT carry a `license` field: the node's v5 schema rejects
 *      the source datasets' license shape.
 *
 * Provider URL split:
 *   - File encryption goes to the node's INTERNAL http URL (192.168.x:8000),
 *     because the public https URL uses a self-signed cert that Node rejects.
 *   - The DDO `serviceEndpoint` uses the PUBLIC url so the marketplace catalog
 *     filter (NEXT_PUBLIC_NODE_URI_INDEXED) matches.
 *
 * USAGE (PowerShell — `node` is not on PATH here, use the full path):
 *   cd scripts/clone-datasets
 *   $env:PRIVATE_KEY = "0x..."            # asset owner wallet, needs Sepolia ETH
 *   & "C:\Program Files\nodejs\node.exe" publish.mjs        # publishes ONE (LIMIT=1)
 *   $env:LIMIT = "0"; & "C:\Program Files\nodejs\node.exe" publish.mjs   # all remaining
 *   $env:START = "3"                       # skip the first 3 publishable entries
 *
 * Config is read from the repo `.env` (../../.env); every value can be
 * overridden with an environment variable of the same name.
 */

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  Wallet,
  JsonRpcProvider,
  parseEther,
  formatEther,
  hexlify,
  toBeHex,
  getAddress
} from 'ethers'
import {
  NftFactory,
  Nft,
  ProviderInstance,
  ConfigHelper,
  getOceanArtifactsAddressesByChainId,
  getHash,
  getEventFromTx,
  ZERO_ADDRESS
} from '@oceanprotocol/lib'
import { generateKeyPair, exportJWK, calculateJwkThumbprint, SignJWT } from 'jose'

// ===========================================================================
// Constants
// ===========================================================================

// Target chain. Default Optimism Sepolia (11155420); set CHAIN_ID=11155111 for
// Ethereum Sepolia. Contract addresses resolve per chain via
// getOceanArtifactsAddressesByChainId; the RPC comes from NEXT_PUBLIC_NODE_URI_MAP.
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 11155420)

// Node URLs. The internal http URL is used for provider calls (the public
// https URL has a self-signed cert Node won't accept); the public URL is used
// as the DDO serviceEndpoint so the catalog filter matches.
const DEFAULT_PRODUCTION_NODE_URL = 'https://node.zdevutils.com/'
const DEFAULT_INTERNAL_PROVIDER_URL = 'http://192.168.130.2:8000'

// Datatoken defaults (mirror the marketplace's app.config.cjs).
const DEFAULT_DATATOKEN_CAP =
  '115792089237316195423570985008687907853269984665640564039457'
const DEFAULT_DATATOKEN_TEMPLATE_INDEX = 2
const DEFAULT_MARKET_FEE_ADDRESS = '0x43eB6644720CFD8B176DC971C6e8c17331812c04'
const MIN_RECOMMENDED_NATIVE_BALANCE = parseEther('0.03')

// A successful ProviderInstance.encrypt() returns a 0x-hex string.
const ENCRYPTED_PROVIDER_RESPONSE = /^0x[0-9a-fA-F]*$/

// ===========================================================================
// Environment / config helpers
// ===========================================================================

/** Parse the repo `.env` into a plain object (strips quotes and trailing #comments). */
async function readRepoEnv() {
  const env = {}
  try {
    const txt = await readFile(new URL('../../.env', import.meta.url), 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue

      let value = m[2].trim()
      const quoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, '').trim()
      env[m[1]] = value
    }
  } catch {
    /* .env is optional */
  }
  return env
}

/** First non-empty value among the given keys, checking process.env then .env. */
function envValue(repoEnv, ...keys) {
  for (const key of keys) {
    const value = process.env[key] ?? repoEnv[key]
    if (value !== undefined && value !== '') return value
  }
}

function parseJsonObject(value) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Parse a value that may be a JSON array, a JSON string, or a bare string. */
function parseEnvArray(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    const values = Array.isArray(parsed) ? parsed : [parsed]
    return values
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  } catch {
    return [value.toString().trim()].filter(Boolean)
  }
}

const stripTrailingSlash = (value) => (value ? value.replace(/\/+$/, '') : value)

/** True for an https URL on localhost / a private LAN range (self-signed cert territory). */
function isSelfSignedPrivateHttps(value) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(
        url.hostname
      )
    )
  } catch {
    return false
  }
}

/**
 * Provider URL used for file encryption. Prefers an explicit override, then the
 * app's provider URL — but if that is a self-signed private https URL (which
 * Node rejects), fall back to the internal http URL that the node also serves.
 */
function resolveProviderUrl(repoEnv) {
  const explicit = process.env.PROVIDER_URL
  if (explicit) return { url: explicit, note: 'from PROVIDER_URL override' }

  const cliProvider = envValue(
    repoEnv,
    'PROVIDER_URL',
    'NEXT_PUBLIC_PROVIDER_HTTP_URL',
    'NEXT_PUBLIC_INTERNAL_PROVIDER_URL'
  )
  if (cliProvider) return { url: cliProvider, note: 'from CLI/internal env' }

  const appProvider = envValue(repoEnv, 'NEXT_PUBLIC_PROVIDER_URL')
  if (isSelfSignedPrivateHttps(appProvider)) {
    return {
      url: DEFAULT_INTERNAL_PROVIDER_URL,
      note: `using internal HTTP provider because ${appProvider} uses a self-signed private-IP certificate in Node`
    }
  }
  return {
    url: appProvider || DEFAULT_PRODUCTION_NODE_URL,
    note: appProvider ? 'from NEXT_PUBLIC_PROVIDER_URL' : 'default'
  }
}

/**
 * Public URL written into the DDO's serviceEndpoint. Must match the value the
 * marketplace filters the catalog by (NEXT_PUBLIC_NODE_URI_INDEXED).
 */
function resolveServiceEndpointUrl(repoEnv, providerUrl) {
  const explicit = process.env.SERVICE_ENDPOINT_URL
  if (explicit) {
    return { url: stripTrailingSlash(explicit), note: 'from SERVICE_ENDPOINT_URL override' }
  }
  const indexedUrl = parseEnvArray(envValue(repoEnv, 'NEXT_PUBLIC_NODE_URI_INDEXED'))[0]
  if (indexedUrl) {
    return { url: stripTrailingSlash(indexedUrl), note: 'from NEXT_PUBLIC_NODE_URI_INDEXED' }
  }
  return { url: stripTrailingSlash(providerUrl), note: 'same as provider URL' }
}

/** Resolve everything the run needs from process.env + repo .env. Exits on hard errors. */
async function resolveRuntimeConfig() {
  const repoEnv = await readRepoEnv()

  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) fail('set PRIVATE_KEY (owner wallet, needs Sepolia ETH).')

  const provider = resolveProviderUrl(repoEnv)
  const serviceEndpoint = resolveServiceEndpointUrl(repoEnv, provider.url)

  let rpcUrl = envValue(repoEnv, 'RPC_URL')
  const nodeUriMap = parseJsonObject(envValue(repoEnv, 'NEXT_PUBLIC_NODE_URI_MAP'))
  if (!rpcUrl && nodeUriMap) rpcUrl = nodeUriMap[String(CHAIN_ID)]
  if (!rpcUrl) rpcUrl = envValue(repoEnv, 'NEXT_PUBLIC_NODE_URI')
  if (!rpcUrl) fail('no RPC_URL (set RPC_URL, NEXT_PUBLIC_NODE_URI_MAP, or NEXT_PUBLIC_NODE_URI).')

  const ipfs = {
    uploadUrl: envValue(repoEnv, 'NEXT_PUBLIC_IPFS_UPLOAD_URL'),
    jwt: envValue(repoEnv, 'IPFS_JWT')
  }
  if (!ipfs.uploadUrl || !ipfs.jwt) {
    fail('IPFS_JWT / NEXT_PUBLIC_IPFS_UPLOAD_URL missing from .env.')
  }

  return {
    privateKey,
    rpcUrl,
    ipfs,
    providerUrl: provider.url,
    providerNote: provider.note,
    serviceEndpointUrl: serviceEndpoint.url,
    serviceEndpointNote: serviceEndpoint.note,
    dataspace:
      envValue(repoEnv, 'DATASPACE', 'NEXT_PUBLIC_DATASPACE') || 'personal-ocean-market',
    marketFeeAddress:
      envValue(repoEnv, 'NEXT_PUBLIC_MARKET_FEE_ADDRESS') || DEFAULT_MARKET_FEE_ADDRESS,
    publisherMarketOrderFee:
      envValue(repoEnv, 'NEXT_PUBLIC_PUBLISHER_MARKET_ORDER_FEE') || '0',
    datatokenCap: envValue(repoEnv, 'DEFAULT_DATATOKEN_CAP') || DEFAULT_DATATOKEN_CAP,
    datatokenTemplateIndex: Number(
      envValue(repoEnv, 'DEFAULT_DATATOKEN_TEMPLATE_INDEX') || DEFAULT_DATATOKEN_TEMPLATE_INDEX
    )
  }
}

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

// ===========================================================================
// Small helpers
// ===========================================================================

const nowSecondsIso = () => new Date().toISOString().replace(/\.[0-9]{3}Z/, 'Z')

/** '0x' + sha256(input) — matches the node's create256Hash (src/utils/crypt.ts). */
const create256Hash = (input) =>
  '0x' + createHash('sha256').update(input).digest('hex')

/** Deterministic Enterprise DID: did:ope: + sha256(checksummed nft + chainId). */
const makeDid = (nftAddress) =>
  'did:ope:' +
  createHash('sha256')
    .update(getAddress(nftAddress) + CHAIN_ID.toString())
    .digest('hex')

/** Slugify tags the way the marketplace does (ascii, lowercase, hyphenated). */
const transformTags = (tags) =>
  (tags || [])
    .map((tag) =>
      tag
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // strip accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)

const resolveServiceType = (ds) => (ds.serviceType === 'compute' ? 'compute' : 'access')

const resolveTimeout = (ds) => {
  const timeout = Number(ds.timeout ?? 0)
  return Number.isFinite(timeout) && timeout >= 0 ? timeout : 0
}

const resolvePrice = (ds, cfg) => {
  const value = Number(ds.price?.value ?? 0)
  const tokenSymbol = ds.price?.tokenSymbol || 'OCEAN'
  const price = {
    value: Number.isFinite(value) ? value : 0,
    tokenSymbol
  }
  if (tokenSymbol === 'OCEAN') price.tokenAddress = cfg.config.oceanTokenAddress
  return {
    ...price
  }
}

const defaultComputeOptions = () => ({
  allowRawAlgorithm: false,
  allowNetworkAccess: true,
  publisherTrustedAlgorithmPublishers: [],
  publisherTrustedAlgorithms: []
})

const urlFileObject = (url) => ({
  type: 'url',
  index: 0,
  url: typeof url === 'string' ? url.trim() : '',
  headers: {},
  method: 'get'
})

// ===========================================================================
// Ocean node interactions
// ===========================================================================

/** Encrypt data via the provider, with a clearer error for the self-signed-cert case. */
async function encryptProviderData(data, providerUrl, signer) {
  let response
  try {
    response = await ProviderInstance.encrypt(data, CHAIN_ID, providerUrl, signer)
  } catch (err) {
    if (err?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      throw new Error(
        `Provider ${providerUrl} uses a self-signed TLS certificate. ` +
          `Run with PROVIDER_URL=${DEFAULT_INTERNAL_PROVIDER_URL} or a trusted HTTPS provider URL.`
      )
    }
    throw err
  }
  if (ENCRYPTED_PROVIDER_RESPONSE.test(response)) return response
  throw new Error(response || 'Provider encryption returned an invalid response')
}

/** Pin a JSON object to IPFS via Pinata; returns the IPFS hash. */
async function uploadToIPFS(data, uploadUrl, jwt) {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ pinataContent: data })
  })
  if (!res.ok) throw new Error(`IPFS upload HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (!json.IpfsHash) throw new Error('IPFS upload: no IpfsHash in response')
  return json.IpfsHash
}

/**
 * Sign a DDO as a self-issued ES256 / did:jwk Verifiable Credential, the way the
 * marketplace signer-server does. A fresh P-256 key is generated per asset; the
 * issuer is the did:jwk of that key, so the node can verify the signature
 * without any external key registry. Returns the compact JWT string.
 */
async function signDdoAsJwtVc(ddo) {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
  const jwk = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(jwk)
  const didJwk = { kty: jwk.kty, crv: jwk.crv, kid, x: jwk.x, y: jwk.y }
  const issuer = 'did:jwk:' + Buffer.from(JSON.stringify(didJwk)).toString('base64url')

  const payload = { ...ddo, type: ['VerifiableCredential'], issuer }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
    .sign(privateKey)
}

// ===========================================================================
// Publish steps
// ===========================================================================

/**
 * Step 1 — create the data NFT + datatoken + free dispenser in one transaction.
 * Returns the freshly deployed NFT and datatoken addresses.
 */
async function createNftWithDatatoken(cfg) {
  const { nftFactory, address, config } = cfg

  const nftCreateData = {
    name: 'Data NFT',
    symbol: 'OEC-NFT',
    templateIndex: 1,
    tokenURI: '',
    transferable: true,
    owner: address
  }
  const datatokenParams = {
    templateIndex: cfg.datatokenTemplateIndex,
    minter: address,
    paymentCollector: address,
    mpFeeAddress: cfg.marketFeeAddress,
    feeToken: config.oceanTokenAddress,
    feeAmount: cfg.publisherMarketOrderFee,
    cap: cfg.datatokenCap,
    name: 'Access Token',
    symbol: 'OEAT'
  }
  const dispenserParams = {
    dispenserAddress: config.dispenserAddress,
    maxTokens: parseEther('1').toString(),
    maxBalance: parseEther('1').toString(),
    withMint: true,
    allowedSwapper: ZERO_ADDRESS
  }

  const tx = await nftFactory.createNftWithDatatokenWithDispenser(
    nftCreateData,
    datatokenParams,
    dispenserParams
  )
  const receipt = await tx.wait()
  const nftAddress = getEventFromTx(receipt, 'NFTCreated')?.args?.newTokenAddress
  const datatokenAddress = getEventFromTx(receipt, 'TokenCreated')?.args?.newTokenAddress
  if (!nftAddress || !datatokenAddress) {
    throw new Error('NFT/datatoken address missing from receipt')
  }
  return { nftAddress, datatokenAddress }
}

function stageError(stage, err) {
  const message = err?.shortMessage || err?.reason || err?.message || String(err)
  const wrapped = new Error(`${stage}: ${message}`)
  wrapped.cause = err
  return wrapped
}

async function runStage(stage, fn) {
  try {
    return await fn()
  } catch (err) {
    throw stageError(stage, err)
  }
}

/**
 * Step 2 — build the DDO v5 object for the dataset. `encryptedFiles` is the
 * provider-encrypted representation of the source file URL. Matches the shape of
 * a working marketplace-published asset (notably: no `license` field, and
 * `credentialSubject.datatokens` omitted — the node re-adds it from chain).
 */
function buildDdo({ ds, nftAddress, datatokenAddress, encryptedFiles, cfg }) {
  const serviceType = resolveServiceType(ds)
  const description = {
    '@value': ds.description || '',
    '@direction': 'ltr',
    '@language': 'en'
  }
  const credentials = {
    allow: [{ type: 'address', values: ['*'] }],
    deny: [],
    match_deny: 'any'
  }
  const now = nowSecondsIso()

  const service = {
    id: getHash(datatokenAddress + encryptedFiles),
    type: serviceType,
    files: encryptedFiles,
    datatokenAddress,
    serviceEndpoint: cfg.serviceEndpointUrl,
    timeout: resolveTimeout(ds),
    name: serviceType === 'compute' ? 'Compute' : 'Dataset',
    description,
    state: 0,
    credentials,
    ...(serviceType === 'compute' ? { compute: defaultComputeOptions() } : {})
  }

  const ddo = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: makeDid(nftAddress),
    version: '5.0.0',
    credentialSubject: {
      chainId: CHAIN_ID,
      ...(cfg.dataspace ? { dataspace: cfg.dataspace } : {}),
      metadata: {
        created: now,
        updated: now,
        type: ds.type || 'dataset',
        name: ds.name,
        description,
        tags: transformTags(ds.tags),
        author: ds.author || '',
        // NOTE: no `license` — the node's v5 schema rejects the source shape.
        additionalInformation: { termsAndConditions: true },
        copyrightHolder: '',
        providedBy: ''
      },
      services: [service],
      nftAddress,
      credentials,
      stats: {
        allocated: 0,
        orders: 0,
        price: resolvePrice(ds, cfg)
      }
    },
    indexedMetadata: {
      nft: {
        name: 'Data NFT',
        symbol: 'OEC-NFT',
        owner: cfg.address,
        address: '',
        state: 0,
        created: ''
      }
    },
    additionalDdos: []
  }
  return ddo
}

/**
 * Step 3 — sign the DDO, upload it to IPFS, and return the on-chain metadata
 * fields. This is the unencrypted (flags = 0) IPFS-pointer flow: the chain only
 * stores a pointer to the DDO on IPFS, so the node never has to decrypt.
 */
async function encodeDdoForChain(ddo, cfg) {
  const jwt = await signDdoAsJwtVc(ddo)

  // What actually lives on IPFS: the JWT, hexlified, under `encryptedData`
  // (the field name is historical — with flags = 0 it is NOT encrypted).
  const ipfsPayload = { encryptedData: hexlify(Buffer.from(JSON.stringify(jwt))) }
  const ipfsHash = await uploadToIPFS(ipfsPayload, cfg.ipfs.uploadUrl, cfg.ipfs.jwt)

  // What lives on-chain: just the IPFS pointer.
  const pointer = { remote: { type: 'ipfs', hash: ipfsHash } }
  return {
    flags: 0,
    metadata: hexlify(Buffer.from(JSON.stringify(pointer))),
    metadataHash: create256Hash(JSON.stringify(ipfsPayload))
  }
}

/** Step 4 — write the metadata on-chain, waiting for update permission first. */
async function writeMetadataOnChain({ nftAddress, encoded, cfg }) {
  const nft = new Nft(cfg.wallet, CHAIN_ID)

  // The NFT's updateMetadata permission can lag a block or two behind creation.
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      await nft.getNftPermissions(nftAddress, cfg.address)
      ready = true
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  if (!ready) throw new Error('Timeout waiting for NFT permissions')

  const tx = await nft.setMetadata(
    nftAddress,
    cfg.address,
    0, // metadata state: active
    cfg.serviceEndpointUrl, // metaDataDecryptorUrl (unused for flags = 0)
    '', // metaDataDecryptorAddress
    toBeHex(encoded.flags),
    encoded.metadata,
    encoded.metadataHash
  )
  const receipt = await tx.wait()
  if (receipt?.status === 0) throw new Error('Metadata transaction failed')
  return tx.hash
}

/** Publish a single dataset end-to-end. Returns { did, nftAddress, txHash }. */
async function publishOne(ds, cfg) {
  const { nftAddress, datatokenAddress } = await runStage(
    'create NFT/datatoken/dispenser',
    () => createNftWithDatatoken(cfg)
  )

  const encryptedFiles = await runStage('encrypt files with provider', () =>
    encryptProviderData(
      { nftAddress, datatokenAddress, files: [urlFileObject(ds.sourceUrl)] },
      cfg.providerUrl,
      cfg.wallet
    )
  )
  if (!encryptedFiles) throw new Error('file encryption returned empty')

  const ddo = buildDdo({ ds, nftAddress, datatokenAddress, encryptedFiles, cfg })
  const encoded = await runStage('sign/upload DDO metadata', () => encodeDdoForChain(ddo, cfg))
  const txHash = await runStage('write metadata on-chain', () =>
    writeMetadataOnChain({ nftAddress, encoded, cfg })
  )

  return { did: ddo.id, nftAddress, txHash }
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  const cfg = await resolveRuntimeConfig()

  // Wallet + on-chain config (contract addresses from the OE artifacts).
  const provider = new JsonRpcProvider(cfg.rpcUrl)
  cfg.wallet = new Wallet(cfg.privateKey, provider)
  cfg.address = await cfg.wallet.getAddress()
  cfg.nativeBalance = await provider.getBalance(cfg.address)

  const config = new ConfigHelper().getConfig(CHAIN_ID)
  const ent = getOceanArtifactsAddressesByChainId(CHAIN_ID)
  config.nftFactoryAddress = ent.ERC721Factory || config.nftFactoryAddress
  config.dispenserAddress = ent.Dispenser || config.dispenserAddress
  config.oceanTokenAddress = ent.Ocean || config.oceanTokenAddress
  cfg.config = config
  cfg.nftFactory = new NftFactory(config.nftFactoryAddress, cfg.wallet)

  // Which datasets to publish (START/LIMIT slice of the publishable entries).
  const all = JSON.parse(await readFile(new URL('./datasets.json', import.meta.url), 'utf8'))
  const publishable = all.filter((d) => d.sourceUrl && !d.error)
  const START = Number(process.env.START ?? 0)
  const LIMIT = Number(process.env.LIMIT ?? 1) // 0 = all remaining
  const slice = LIMIT > 0 ? publishable.slice(START, START + LIMIT) : publishable.slice(START)

  console.log(`Wallet:           ${cfg.address}`)
  console.log(`Balance:          ${formatEther(cfg.nativeBalance)} native gas token`)
  if (cfg.nativeBalance < MIN_RECOMMENDED_NATIVE_BALANCE) {
    console.log(
      `WARNING:          balance is below ${formatEther(
        MIN_RECOMMENDED_NATIVE_BALANCE
      )}; NFT+datatoken publishes can fail with "missing revert data" when gas is low`
    )
  }
  console.log(`Provider:         ${cfg.providerUrl}  (${cfg.providerNote})`)
  console.log(`Service endpoint: ${cfg.serviceEndpointUrl}  (${cfg.serviceEndpointNote})`)
  console.log(`Dataspace:        ${cfg.dataspace}`)
  console.log(
    `Publishing ${slice.length} of ${publishable.length} publishable (START=${START}, LIMIT=${LIMIT})\n`
  )

  const results = []
  let idx = START
  for (const ds of slice) {
    process.stdout.write(`[${idx}] ${ds.name} ... `)
    try {
      const { did, nftAddress, txHash } = await publishOne(ds, cfg)
      console.log(`OK ${did}`)
      console.log(`    NFT: ${nftAddress}`)
      console.log(`    setMetadata tx: ${txHash}`)
      results.push({ idx, name: ds.name, did, ok: true })
    } catch (err) {
      console.log(`FAILED: ${err.shortMessage || err.message}`)
      results.push({ idx, name: ds.name, ok: false, error: err.message })
    }
    idx++
  }

  const ok = results.filter((r) => r.ok)
  console.log(`\nDone. ${ok.length} published, ${results.length - ok.length} failed.`)
  if (ok.length) {
    console.log('Give the node ~1 min to index, then check the catalog. DIDs:')
    ok.forEach((r) => console.log(`  ${r.did}`))
    if (LIMIT > 0) {
      console.log('\nTo publish the rest:  $env:START="1"; $env:LIMIT="0"; node publish.mjs')
    }
  }
  process.exit(results.some((r) => !r.ok) ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
