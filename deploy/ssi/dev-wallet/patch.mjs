// Patches the compiled key page of oceanenterprise/waltid-dev-wallet (gaiax-0.1.5-OE).
// Runs at image build time; fails the build if the expected code is not found,
// so a new upstream version cannot silently ship unpatched.
//
// 1. "Public JWK" showed the full key, private part ("d") included. Now private
//    members are stripped before display.
// 2. The JWK shown had no "kid" when the key was imported without one, although
//    the page shows the wallet's key ID. Now the shown JWK carries that kid.
// 3. "Delete key" navigated away in .finally(), so a failed delete looked like a
//    success. Now it asks for confirmation and reports errors.
// 4. "Import key" failed silently (unhandled error, the page just stayed).
//    Now the error is shown.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PRIVATE = '["d","p","q","dp","dq","qi","k","oth"]'
const CONFIRM = 'Delete this key? Any DID that uses it will no longer be able to sign presentations.'

const patches = [
  {
    dir: '/public/_nuxt',
    from: 'w=h(()=>l.value?JSON.stringify(l.value,null,2):"Loading…")',
    to: `w=h(()=>{if(!l.value)return"Loading…";const z=Object.assign({},l.value);${PRIVATE}.forEach(f=>delete z[f]);z.kid=z.kid||r;return JSON.stringify(z,null,2)})`
  },
  {
    dir: '/public/_nuxt',
    from: 'async function S(){await $fetch(`/wallet-api/wallet/${n.value}/keys/${r}`,{method:"DELETE"}).finally(()=>{A(`/wallet/${n.value}/settings/keys`)})}',
    to: `async function S(){if(!confirm(${JSON.stringify(CONFIRM)}))return;try{await $fetch(\`/wallet-api/wallet/\${n.value}/keys/\${r}\`,{method:"DELETE"});A(\`/wallet/\${n.value}/settings/keys\`)}catch(e){alert("Could not delete the key: "+(e&&e.data&&e.data.message||e&&e.message||e))}}`
  },
  {
    dir: '/public/_nuxt',
    from: 'await $fetch(`/wallet-api/wallet/${r.value}/keys/import?alias=${encodeURIComponent(o.value)}`,{method:"POST",body:s}),w(`/wallet/${r.value}/settings/keys`)',
    to: 'try{await $fetch(`/wallet-api/wallet/${r.value}/keys/import?alias=${encodeURIComponent(o.value)}`,{method:"POST",body:s})}catch(e){alert("Could not import the key: "+(e&&e.data&&e.data.message||e&&e.message||e));return}w(`/wallet/${r.value}/settings/keys`)'
  },
  {
    dir: '/server/chunks/build',
    from: 'const formattedJwk = computed(() => jwk.value ? JSON.stringify(jwk.value, null, 2) : "Loading\\u2026");',
    to: `const formattedJwk = computed(() => { if (!jwk.value) return "Loading\\u2026"; const z = Object.assign({}, jwk.value); ${PRIVATE}.forEach((f) => delete z[f]); z.kid = z.kid || keyId; return JSON.stringify(z, null, 2); });`
  },
  {
    dir: '/server/chunks/build',
    from: 'await $fetch(`/wallet-api/wallet/${currentWallet.value}/keys/${keyId}`, {\n        method: "DELETE"\n      }).finally(() => {\n        navigateTo(`/wallet/${currentWallet.value}/settings/keys`);\n      });',
    to: `if (!confirm(${JSON.stringify(CONFIRM)})) return;\n      try {\n        await $fetch(\`/wallet-api/wallet/\${currentWallet.value}/keys/\${keyId}\`, { method: "DELETE" });\n        navigateTo(\`/wallet/\${currentWallet.value}/settings/keys\`);\n      } catch (e) {\n        alert("Could not delete the key: " + (e && e.data && e.data.message || e && e.message || e));\n      }`
  }
]

let failed = false
for (const p of patches) {
  const hits = readdirSync(p.dir)
    .filter((f) => /\.(m?js)$/.test(f))
    .map((f) => join(p.dir, f))
    .filter((f) => readFileSync(f, 'utf8').includes(p.from))
  if (hits.length !== 1) {
    console.error(`patch not applied (${hits.length} matches in ${p.dir}): ${p.from.slice(0, 70)}…`)
    failed = true
    continue
  }
  const src = readFileSync(hits[0], 'utf8')
  writeFileSync(hits[0], src.replace(p.from, p.to))
  console.log(`patched ${hits[0]}`)
}
if (failed) process.exit(1)
