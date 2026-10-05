# clone-datasets

Bulk-publish datasets into the Ocean Enterprise marketplace (`market-empower-x`,
Sepolia). Given a list of datasets and their source data URLs, this publishes
each one as an Ocean Enterprise **DDO v5 "access"** asset — the same result as
publishing through the marketplace UI, but scripted for many datasets at once.

## Two-stage workflow

```
fetch-metadata.mjs   ──►   datasets.json   ──►   publish.mjs
   (read metadata)         (+ your URLs)         (mint + publish on-chain)
```

1. **`fetch-metadata.mjs`** — reads the source DDOs (from the Ocean Enterprise
   stage nodes) and writes `datasets.json` with each dataset's copyable
   metadata (name, description, tags, author) plus an empty `sourceUrl`.
   The real data-source URL cannot be recovered from a published DDO (the file
   list is encrypted), so you fill `sourceUrl` in yourself.

2. **Fill in `sourceUrl`** for each entry in `datasets.json`.

3. **`publish.mjs`** — for every entry that has a `sourceUrl`, creates the
   NFT + datatoken + free dispenser, encrypts the file URL, builds and signs the
   DDO, and writes it on-chain so the node indexes it into the catalog.

## Usage

`node` is installed but **not on PATH** in this environment — use the full path.

```powershell
cd scripts/clone-datasets
npm install                                        # once (jose, ethers, @oceanprotocol/lib)

# Stage 1 — build datasets.json (no wallet needed)
& "C:\Program Files\nodejs\node.exe" fetch-metadata.mjs

# ... fill in each "sourceUrl" in datasets.json ...

# Stage 2 — publish (needs the owner wallet + Sepolia ETH)
$env:PRIVATE_KEY = "0x..."                         # asset owner wallet
& "C:\Program Files\nodejs\node.exe" publish.mjs   # publishes ONE (LIMIT=1) as a test

# once the test asset appears in the catalog, publish the rest:
$env:START = "1"; $env:LIMIT = "0"
& "C:\Program Files\nodejs\node.exe" publish.mjs
```

### Environment variables

`publish.mjs` reads config from the repo `.env` (`../../.env`); any value can be
overridden with an env var of the same name.

| Var | Purpose | Default |
| --- | --- | --- |
| `PRIVATE_KEY` | Owner wallet (needs Sepolia ETH) | — (required) |
| `START` | Index of the first publishable entry to publish | `0` |
| `LIMIT` | How many to publish; `0` = all remaining | `1` |
| `PROVIDER_URL` | Provider used for file encryption | internal node http URL |
| `SERVICE_ENDPOINT_URL` | Public URL written into the DDO | `NEXT_PUBLIC_NODE_URI_INDEXED` |
| `DATASPACE` | Marketplace dataspace tag | `personal-ocean-market` |

## How the on-chain format was chosen (important)

The node only indexes assets shaped *exactly* the way the marketplace's
signer-server produces them. `publish.mjs` reproduces that, verified against a
real UI-published asset. The non-obvious requirements:

- **DID scheme** is `did:ope:` (Enterprise v5), not plain `did:op:`.
- **Signature**: the DDO is a self-issued **ES256 / did:jwk** Verifiable
  Credential (fresh P-256 key per asset). The node cannot decode an ETH-EIP191
  wallet signature.
- **Storage**: metadata is stored **unencrypted** (on-chain `flags = 0`) as an
  **IPFS pointer** — the DDO JWT goes to IPFS and the chain holds only
  `{"remote":{"type":"ipfs","hash":"..."}}`. With `flags = 0` the node reads it
  directly and never calls back to itself to decrypt. (This node cannot reach
  its own public URL due to NAT hairpin, so encrypted/`flags = 2` assets never
  index.)
- **Hash**: `metaDataHash = sha256(JSON.stringify(ipfsPayload))`.
- **No `license` field** — the node's v5 schema rejects the source datasets'
  license shape.
- **Provider URL split** — file encryption uses the node's *internal* http URL
  (the public https URL uses a self-signed cert Node rejects); the DDO
  `serviceEndpoint` uses the *public* URL so the catalog filter matches.

## Files

| File | Purpose |
| --- | --- |
| `fetch-metadata.mjs` | Stage 1: read source DDOs → `datasets.json`. |
| `datasets.json` | The datasets to publish (metadata + your `sourceUrl`s). |
| `publish.mjs` | Stage 2: mint + publish each dataset on-chain. |
| `diagnose-indexing.mjs` | Read-only: why did a published DID fail to index? (`DID`/`NFT`/`TX` env). |
| `reindex-tx.mjs` | Admin helper: ask the node to reindex one existing tx (no gas). |

## Troubleshooting

- **Published but not in the catalog?** Give the node ~1 minute, then run
  `diagnose-indexing.mjs` with the `DID`/`NFT`/`TX` to see the node's state and
  error for that asset.
- **`self-signed certificate` during encryption** — set `PROVIDER_URL` to the
  node's internal http URL (the default already does this when the app's
  provider URL is a private-IP https URL).
