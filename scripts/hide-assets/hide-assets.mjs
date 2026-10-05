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
 *   PRIVATE_KEY=0xabc... node hide-assets.mjs          # hide all (state 5)
 *   PRIVATE_KEY=0xabc... STATE=0 node hide-assets.mjs   # restore all (state 0)
 *
 * Optional env:
 *   RPC_URL   override the Sepolia RPC endpoint
 *   STATE     target metadata state (default 5 = Unlisted)
 */

import { ethers } from 'ethers'

const DEFAULT_RPC =
  'https://ethereum-sepolia-rpc.publicnode.com'

const RPC_URL = process.env.RPC_URL || DEFAULT_RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY
const STATE = Number(process.env.STATE ?? 5)

// The 11 data NFTs owned by 0x02B54d89725a073bAA05795aa9359072694c39d0.
// Each entry: [short DID, NFT contract address]
const ASSETS = [
  ['126a2761', '0xd8576cfb3890b4065a1311d0E3F0392Ec1f9b69F'],
  ['6a28fd8a', '0x3c06A4Df7528784cBAA2D1d48367370Be75759Fc'],
  ['d1974da4', '0x8a96EC9E770Bb7f79b0d71E303F406bE1B69Cae2'],
  ['4fe9678f', '0xD6F5487de333bd601763BeaDB4D0396A6119B7Fd'],
  ['8cfd23cf', '0x6388666BFA67b48cD2b01520A765E252491f99e2'],
  ['744d4d36', '0xb9D05e1B1151853541F5485a926C652a5cB3Db96'],
  ['39fdea02', '0x484F4acdF256bAa6a6050EC915FF355bA641b35f'],
  ['ee9c5900', '0x1B28ec4a0cab609b07512E0e71AD6BCa550a7667'],
  ['319e204a', '0xcDee8AD89fA58195E00645ca48Cd8eB99DA0302b'],
  ['6f06da54', '0x276caB6716D97fc1FBdd15a6c5908eC976e9b2c5'],
  ['09b8cbb8', '0xB8081aAAE7b186204bd5c55FE64e2B012aB58CEa']
]

// Minimal Ocean ERC721Template ABI: just the state setter + a reader.
const ABI = [
  'function setMetaDataState(uint8 _metaDataState) external',
  'function getMetaData() external view returns (string, string, uint8, bool)'
]

async function main() {
  if (!PRIVATE_KEY) {
    console.error('ERROR: set PRIVATE_KEY (the wallet that owns the assets).')
    process.exit(1)
  }
  if (!Number.isInteger(STATE) || STATE < 0 || STATE > 255) {
    console.error(`ERROR: invalid STATE "${process.env.STATE}" (expected 0-255).`)
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const from = await wallet.getAddress()

  const network = await provider.getNetwork()
  const action = STATE === 0 ? 'RESTORE (Active)' : `HIDE (state ${STATE})`
  console.log(`Wallet:  ${from}`)
  console.log(`Chain:   ${network.chainId}`)
  console.log(`Action:  ${action}`)
  console.log(`Assets:  ${ASSETS.length}`)
  console.log('')

  let ok = 0
  let failed = 0

  for (const [did, nftAddress] of ASSETS) {
    const nft = new ethers.Contract(nftAddress, ABI, wallet)
    try {
      // Skip if already in the target state.
      let current
      try {
        const meta = await nft.getMetaData()
        current = Number(meta[2])
      } catch {
        current = undefined
      }
      if (current === STATE) {
        console.log(`= ${did}  ${nftAddress}  already state ${STATE}, skipped`)
        ok++
        continue
      }

      const tx = await nft.setMetaDataState(STATE)
      process.stdout.write(`… ${did}  ${nftAddress}  tx ${tx.hash} `)
      await tx.wait()
      console.log('✓ confirmed')
      ok++
    } catch (err) {
      console.log('')
      console.error(`✗ ${did}  ${nftAddress}  FAILED: ${err.shortMessage || err.message}`)
      failed++
    }
  }

  console.log('')
  console.log(`Done. ${ok} ok, ${failed} failed.`)
  if (STATE !== 0) {
    console.log('Assets will drop out of the catalog once the node re-indexes.')
    console.log('To restore: STATE=0 node hide-assets.mjs')
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
