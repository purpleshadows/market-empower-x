# SSI stack (credential-based access) — Portainer deployment

Lets data providers restrict assets to users holding a verifiable credential
(e.g. "member of the Empower-X consortium"). Built from the Ocean Enterprise
components ([waltid-identity `OE` branch](https://github.com/OceanProtocolEnterprise/waltid-identity/tree/OE/docker-compose),
[policy-server](https://github.com/OceanProtocolEnterprise/policy-server)),
packaged so it runs as Portainer stacks with no files on the host.

```
browser ──https──> nginx-proxy ──> wallet-gateway ─┬─ /wallet-api/* → wallet-api ── postgres
                                                   └─ /             → web wallet UI
market ──> Ocean node ──POLICY_SERVER_URL──> policy-server ──> verifier-api ──> opa-server
wallet-api ──> policy-server-proxy ──> Ocean node (passthrough) ──> policy-server
```

Only the wallet is public. Everything else talks over the internal `ssi`
network, except the node ↔ policy server link (LAN).

| File | What |
|---|---|
| `docker-compose.yml` | Main stack: wallet, verifier, OPA, policy server (+ proxy) |
| `docker-compose.tools.yml` | Optional: issuer + portal to issue credentials (admin, LAN only) |
| `config/` | walt.id config templates, rendered at start by the `ssi-config` init container |
| `stack.env.example` | All settings, with comments |
| `scripts/generate-secrets.mjs` | Generates the per-deployment keys |

Tested end to end (2026-10-07): MetaMask login → credential issued and
accepted → policy server session for a credential-gated asset → presentation
verified → redirect to the market's `/success` page; a wallet without the
credential is denied.

## Prerequisites

- The host runs **nginx-proxy + acme-companion** (same as the marketplace) on
  the `docker_default` network.
- A DNS record for `wallet.zdevutils.com` pointing at that host (or a
  `*.zdevutils.com` wildcard). The hostnames are set in the compose files.
- The **Ocean node can reach this host** on the policy server port (default
  8001), and this host can reach the node (`https://node.zdevutils.com`).

## 1. Generate secrets

```bash
node deploy/ssi/scripts/generate-secrets.mjs
```

Keep the output safe. The upstream walt.id configs ship fixed example keys
that are public on GitHub — anyone could forge wallet sessions with them. The
templates here only use the generated values.

## 2. Deploy the main stack in Portainer

Stacks → Add stack → **Repository**:

- Repository URL: this repo, reference `refs/heads/main`
- Compose path: `deploy/ssi/docker-compose.yml`
- Environment variables (Advanced mode): `LETSENCRYPT_EMAIL`, the generated
  secrets and the policy server bind settings (see `stack.env.example`).

Repository mode is required: the `ssi-config` service is built from
`deploy/ssi/config`. On first start it renders the configs, generates the OPA
TLS certificate, and exits (status "Exited (0)" is expected).

Check: `https://wallet.zdevutils.com/` shows the walt.id web wallet, and
`https://wallet.zdevutils.com/wallet-api/auth/account/web3/nonce` returns a token.

## 3. Connect the Ocean node

On the node host, add to the node's env file (`~/soft/ocean/oe-node/.env.node`):

```
POLICY_SERVER_URL=http://<this-host-LAN-IP>:8001
```

and recreate the node (`docker compose up -d` in the node folder).

From then on **every** download and compute job goes through the policy
server, which requires a session per asset. The marketplace from this repo
handles that (step 4). To roll back, remove the line and recreate the node.

## 4. Point the marketplace at the wallet

Marketplace stack environment:

```
NEXT_PUBLIC_SSI_ENABLED=true
NEXT_PUBLIC_SSI_WALLET_API=https://wallet.zdevutils.com
NEXT_PUBLIC_SSI_UI_URL=https://wallet.zdevutils.com
```

and redeploy (the image must include the 2026-10-07 policy-server detection
change, i.e. be built from this repo after that date).

Assets without credential rules keep working: the marketplace opens a session
that the policy server approves immediately. Assets with an SSI policy ask the
user to present a matching credential from their wallet.

## 5. Issue credentials (optional tools stack)

Deploy `deploy/ssi/docker-compose.tools.yml` as a second stack (same
environment; set `TOOLS_HOST`/`TOOLS_BIND` to this host's LAN IP). It joins the
`ssi` network, so deploy it after the main stack.

1. The user logs in once at `https://wallet.zdevutils.com` with MetaMask (same
   account as in the marketplace).
2. An admin opens `http://<TOOLS_HOST>:7102`, picks a credential type, and
   issues it; the user accepts it in the web wallet.
3. Publish an asset whose access rules require that credential type (publish
   form → access policies → SSI policy). Only holders can then buy, download or
   run compute on it.

## Versions

| Component | Version | Why |
|---|---|---|
| policy-server | `v1.3.2` | Last release for OE Node 3.x. Use `v1.3.3+` only with Node 4.2.1 (market 1.5.x is designed for Node 4.2.1). |
| wallet-api / verifier-api | `gaiax-0.1.1-OE` / `gaiax-0.1.2-OE` | OE builds |
| issuer-api | `0.23.2` | 0.15.x/0.16.x crash on start: hardcoded example certificate dates expired in 2026 |
| web wallet / portal | `0.15.1` | |
| OPA | `1.4.2` | |

Override any of them with the `*_VERSION` variables.

## Security notes

- The policy server port must stay on the LAN: set `POLICY_SERVER_BIND` to the
  LAN IP and/or firewall it.
- The tools stack (issuer/portal) is an admin tool: bind it to the LAN IP,
  never publish it.
- CORS on `/wallet-api/` only admits the origins in `MARKET_ORIGINS`.
- Secrets live only in the Portainer stack environment; `deploy/ssi/stack.env`
  is gitignored if you keep a local copy.
