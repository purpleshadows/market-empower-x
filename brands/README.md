# Multi-brand marketplace

One codebase, multiple branded marketplaces. All shared logic (compute flow,
queries, fixes) lives in `src/` and is identical across brands. Only the
brand-specific assets differ, and they live here under `brands/<brand>/`.

## How it works

At build time, `scripts/apply-brand.cjs <brand>` copies the selected brand's
files into the active locations the app imports from:

| brands/<brand>/        | copied to                      |
| ---------------------- | ------------------------------ |
| `colors.css`           | `src/stylesGlobal/_colors.css` |
| `site.json`            | `content/site.json`            |
| `login.json`           | `content/auth/login.json`      |
| `public/<files>`       | `public/<files>`               |
| `images/<files>`       | `src/@images/<files>`          |

`images/` holds logos imported as React components at build time — notably
`logo-white.svg`, the header logo (`import LogoAsset from '@images/logo-white.svg'`).

The default brand is **empower**, so a plain `npm run build` / `docker build`
produces the Empower-X marketplace unchanged.

## Build each marketplace image

```bash
# Empower-X (default)
docker build -t purpleshadows/market-empower-x:latest .

# RegenAg-X
docker build --build-arg BRAND=regenag -t purpleshadows/market-regenag-x:latest .
```

Locally, to preview a brand in dev:

```bash
npm run apply-brand:regenag   # swaps active assets to regenag
npm run start
# restore with:  npm run apply-brand:empower   (or: git checkout -- src/stylesGlobal/_colors.css content public)
```

## Deploy

Both marketplaces use the **same Ocean node/chain** but **different dataspaces**,
so each catalogue shows only its own assets. Deploy `docker-compose.regenag.yml`
as a separate Portainer stack with regenag's env:

- `VIRTUAL_HOST` / `LETSENCRYPT_HOST` = `regenag-x.com`
- `NEXT_PUBLIC_DATASPACE` = `regenag-x`  (distinct from empower's)
- everything else (node URLs, RPC map, ERC20 allowlist, IPFS) = identical to empower

## ⚠️ regenag/ still needs REAL brand assets

`brands/regenag/` was seeded from empower as a placeholder. Replace before launch:

- [ ] `brands/regenag/colors.css` — currently Empower-X blue. Swap in RegenAg-X's
      palette (edit the `--brand-*` / `--empower-*` / gradient values; keeping the
      variable NAMES is fine, only change the hex values).
- [ ] `brands/regenag/public/logo.svg`, `logo-white.svg`, `logo-negative.svg`,
      `icon.svg`, `favicon.ico`, `apple-touch-icon.png`, `android-chrome-*.png`,
      `share.png` — currently Empower-X logos.
- [x] `brands/regenag/site.json`, `login.json` — text already rebranded to RegenAg-X.
