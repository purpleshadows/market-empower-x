#!/usr/bin/env node
/*
 * Applies a brand's assets into the active locations the app imports from.
 *
 * Usage:
 *   node scripts/apply-brand.cjs <brand>
 *   BRAND=<brand> node scripts/apply-brand.cjs
 *
 * Brands live under brands/<brand>/:
 *   colors.css        -> src/stylesGlobal/_colors.css
 *   site.json         -> content/site.json
 *   login.json        -> content/auth/login.json
 *   public/<files>    -> public/<files>
 *
 * Default brand is "empower" so a plain build (no brand specified) produces the
 * Empower-X marketplace. The Dockerfile passes BRAND to build each marketplace
 * image from this single codebase.
 */
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const brand = (process.argv[2] || process.env.BRAND || 'empower').trim()
const brandDir = path.join(repoRoot, 'brands', brand)

if (!fs.existsSync(brandDir)) {
  const available = fs.existsSync(path.join(repoRoot, 'brands'))
    ? fs.readdirSync(path.join(repoRoot, 'brands'))
    : []
  console.error(
    `[apply-brand] Unknown brand "${brand}". Available: ${available.join(', ') || '(none)'}`
  )
  process.exit(1)
}

const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`  ${path.relative(repoRoot, from)} -> ${path.relative(repoRoot, to)}`)
}

console.log(`[apply-brand] Applying brand "${brand}"`)

const fileMap = [
  ['colors.css', 'src/stylesGlobal/_colors.css'],
  ['site.json', 'content/site.json'],
  ['login.json', 'content/auth/login.json']
]
for (const [src, dest] of fileMap) {
  const from = path.join(brandDir, src)
  if (fs.existsSync(from)) copyFile(from, path.join(repoRoot, dest))
  else console.warn(`  (skip) brands/${brand}/${src} not found`)
}

const publicSrc = path.join(brandDir, 'public')
if (fs.existsSync(publicSrc)) {
  for (const file of fs.readdirSync(publicSrc)) {
    copyFile(path.join(publicSrc, file), path.join(repoRoot, 'public', file))
  }
}

// Logos imported at build time as React components (e.g. the header logo,
// import LogoAsset from '@images/logo-white.svg'). brands/<brand>/images/<file>
// overrides src/@images/<file>.
const imagesSrc = path.join(brandDir, 'images')
if (fs.existsSync(imagesSrc)) {
  for (const file of fs.readdirSync(imagesSrc)) {
    copyFile(path.join(imagesSrc, file), path.join(repoRoot, 'src/@images', file))
  }
}

console.log(`[apply-brand] Done.`)
