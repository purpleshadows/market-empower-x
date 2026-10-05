# v4 aquarius bridge

Makes an Ocean **Enterprise** node (DDO v5) answer like a **standard Ocean**
node (DDO v4), so any standard Ocean Market — Pontus-X, etc. — can list its
assets.

## Why this exists

Your node (`node.zdevutils.com`) stores DDO **v5** documents: everything wrapped
under `credentialSubject`, DIDs `did:ope:…`, ES index `op_ddo_v5.0.0`. A standard
Ocean Market speaks DDO **v4**: flat `metadata`/`services`/`chainId`, DIDs
`did:op:…`, index `op_ddo_v4.1.0`. The two query dialects don't match, so a
standard market querying your node gets `[]` — and vice-versa.

This bridge sits in front of your node and translates both directions:

```
standard Ocean Market ──v4 query──▶ bridge ──v5 query──▶ OE node
                      ◀─flat v4 DDOs─┘   ◀── v5 DDOs ────┘
```

## What it translates

| | v4 (market) | v5 (your node) |
|---|---|---|
| index | `op_ddo_v4.1.0` | `op_ddo_v5.0.0` |
| chainId | `chainId` | `credentialSubject.chainId` |
| metadata / services | flat | `credentialSubject.*` (services *nested*) |
| DID | `did:op:<hash>` | `did:ope:<hash>` (same hash) |
| indexedMetadata | identical | identical |

- **Requests:** field paths are rewritten, `services.*` filters are wrapped in a
  `nested` query, `did:op:` values become `did:ope:`, the index is forced to v5.
- **Responses:** each v5 document is flattened to a v4 DDO (`credentialSubject`
  unwrapped, i18n `description` collapsed to a string, `did:ope:`→`did:op:`).

Endpoints: `POST /api/aquarius/assets/metadata/query`,
`GET /api/aquarius/assets/ddo/:did`, `GET /api/aquarius/assets/metadata/:did`,
`GET /api/aquarius/state/ddo`. Everything else is proxied through unchanged.

## Run locally

```bash
UPSTREAM=https://node.zdevutils.com PORT=8080 node bridge.mjs
node test.mjs   # live translation test against the node
```

## Deploy on the node machine

```bash
docker compose up -d --build
```

Then front `:8092` with the same reverse proxy that serves
`node.zdevutils.com`, on its own hostname (e.g. `bridge.zdevutils.com`), and give
that HTTPS URL to the other market as its `metadataCacheUri`.

## Known limitations (this is a compatibility shim, not a merge)

- **Listing/browse works; buy & download do not.** Consuming a v5 asset needs the
  OE provider + Verifiable-Credential/SSI access flow, which a standard v4 market
  can't drive.
- **Tag-filter facet is empty.** Your node's index doesn't populate `.keyword`
  term aggregations (the OE market has the same limitation).
- One bridge = one direction (them → you). Seeing *their* v4 assets in *your* OE
  market would need the reverse translation in the market's query layer.
