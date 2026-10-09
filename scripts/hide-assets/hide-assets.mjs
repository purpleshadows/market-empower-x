/**
 * Batch hide (unlist) or restore Ocean data NFT assets on Sepolia.
 *
 * Sets the on-chain metadata state on each data NFT via setMetaDataState(uint8).
 * The Ocean node re-indexes the MetadataState event and the marketplace catalog
 * (which filters on indexedMetadata.nft.state === 0) then stops listing them.
 *
 *   state 0 = Active   (shown in catalog)
 *   state 5 = Unlisted (hidden from catalog/search, still resolvable by DID)
 *
 * The caller wallet must be the NFT owner / hold the updateMetadata role
 * (the same wallet that published the asset).
 *
 * Usage:
 *   cd scripts/hide-assets
 *   npm install
 *   DRY_RUN=1 node hide-assets.mjs cleanup-2026-10.json                 # preview
 *   PRIVATE_KEY=0xabc... node hide-assets.mjs cleanup-2026-10.json          # hide
 *   PRIVATE_KEY=0xabc... STATE=0 node hide-assets.mjs cleanup-2026-10.json  # restore
 *
 * Lists: cleanup-2026-10.json (test/duplicate assets, Oct 2026),
 *        hidden-2026-07.json (July 2026 test assets, already hidden).
 *
 * Optional env:
 *   RPC_<chainId>  override an RPC endpoint (RPC_URL = Sepolia, kept for compat)
 *   STATE     target metadata state (default 5 = Unlisted)
 *   DRY_RUN=1 only show owners/states, send nothing (no key needed)
 */

import { readFileSync } from 'node:fs'
import { ethers } from 'ethers'

// Public RPCs per chain; override with RPC_<chainId>, e.g. RPC_11155420=...
const DEFAULT_RPCS = {
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  11155420: 'https://sepolia.optimism.io'
}
const rpcFor = (chainId) =>
  process.env[`RPC_${chainId}`] ||
  (chainId === 11155111 && process.env.RPC_URL) ||
  DEFAULT_RPCS[chainId]
const PRIVATE_KEY = process.env.PRIVATE_KEY
const STATE = Number(process.env.STATE ?? 5)

// Assets to process come from a JSON list (first CLI argument):
//   [{ "name": "...", "did": "did:ope:...", "nft": "0x...", "chainId": 11155111,
//      "reason": "..." }]   (chainId defaults to Sepolia)
// Assets whose data NFT is not owned by the signing wallet are skipped, so one
// list can mix owners: each owner runs it with their own key.
const LIST_FILE = process.argv[2]
const DRY_RUN = process.env.DRY_RUN === '1'

// Minimal Ocean ERC721Template ABI: just the state setter + a reader.
const ABI = [
  'function setMetaDataState(uint8 _metaDataState) external',
  'function getMetaData() external view returns (string, string, uint8, bool)',
  'function ownerOf(uint256 tokenId) external view returns (address)'
]

async function main() {
  if (!LIST_FILE) {
    console.error('ERROR: pass the asset list, e.g. node hide-assets.mjs cleanup-2026-10.json')
    process.exit(1)
  }
  const ASSETS = JSON.parse(readFileSync(LIST_FILE, 'utf8'))
  if (!PRIVATE_KEY && !DRY_RUN) {
    console.error('ERROR: set PRIVATE_KEY (the wallet that owns the assets), or DRY_RUN=1.')
    process.exit(1)
  }
  if (!Number.isInteger(STATE) || STATE < 0 || STATE > 255) {
    console.error(`ERROR: invalid STATE "${process.env.STATE}" (expected 0-255).`)
    process.exit(1)
  }

  const from = PRIVATE_KEY
    ? new ethers.Wallet(PRIVATE_KEY).address
    : '(dry run, no wallet)'
  const signers = {}
  const signerFor = (chainId) => {
    if (!signers[chainId]) {
      const rpc = rpcFor(chainId)
      if (!rpc) throw new Error(`no RPC for chain ${chainId} (set RPC_${chainId})`)
      const provider = new ethers.JsonRpcProvider(rpc)
      signers[chainId] = PRIVATE_KEY
        ? new ethers.Wallet(PRIVATE_KEY, provider)
        : provider
    }
    return signers[chainId]
  }
  const action = STATE === 0 ? 'RESTORE (Active)' : `HIDE (state ${STATE})`
  console.log(`Wallet:  ${from}`)
  console.log(`Action:  ${action}`)
  console.log(`Assets:  ${ASSETS.length}`)
  console.log('')

  let ok = 0
  let failed = 0
  let skipped = 0

  for (const { did, nft: nftAddress, name, chainId = 11155111 } of ASSETS) {
    const label = `${name || did} [chain ${chainId}]`
    try {
      const nft = new ethers.Contract(nftAddress, ABI, signerFor(chainId))
      const owner = await nft.ownerOf(1)
      if (DRY_RUN) {
        const meta = await nft.getMetaData()
        console.log(`- ${label}
    owner ${owner}  state ${Number(meta[2])}`)
        continue
      }
      if (owner.toLowerCase() !== from.toLowerCase()) {
        console.log(`- ${label}  owned by ${owner}, skipped`)
        skipped++
        continue
      }
      // Skip if already in the target state.
      let current
      try {
        const meta = await nft.getMetaData()
        current = Number(meta[2])
      } catch {
        current = undefined
      }
      if (current === STATE) {
        console.log(`= ${label}  already state ${STATE}, skipped`)
        ok++
        continue
      }

      const tx = await nft.setMetaDataState(STATE)
      process.stdout.write(`… ${label}  tx ${tx.hash} `)
      await tx.wait()
      console.log('✓ confirmed')
      ok++
    } catch (err) {
      console.log('')
      console.error(`✗ ${label}  FAILED: ${err.shortMessage || err.message}`)
      failed++
    }
  }

  console.log('')
  if (DRY_RUN) process.exit(0)
  console.log(`Done. ${ok} ok, ${skipped} skipped (other owner), ${failed} failed.`)
  if (STATE !== 0) {
    console.log('Assets will drop out of the catalog once the node re-indexes.')
    console.log(`To restore: STATE=0 node hide-assets.mjs ${LIST_FILE}`)
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
