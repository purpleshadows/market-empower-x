/**
 * Live test: send a standard-Ocean (v4) query — exactly the shape Alexander's
 * market emits — through the translation layer to your OE node, and confirm the
 * flattened response comes back as valid v4 DDOs.
 *
 *   node test.mjs
 */
import {
  rewriteQueryV4toV5,
  flattenQueryResponse,
  didV4toV5,
  didV5toV4
} from './transform.mjs'

const UPSTREAM = process.env.UPSTREAM || 'https://node.zdevutils.com'

// A representative standard-Ocean v4 search: datasets on two chains, not burnt,
// not in purgatory, an access-service filter, sorted by creation, with a tags agg.
const v4Query = {
  from: 0,
  size: 5,
  query: {
    bool: {
      filter: [
        { terms: { chainId: [11155111, 11155420] } },
        { term: { 'metadata.type': 'dataset' } },
        { term: { 'services.type': 'access' } },
        { term: { 'indexedMetadata.purgatory.state': false } },
        { bool: { must_not: [{ term: { 'indexedMetadata.nft.state': 5 } }] } }
      ]
    }
  },
  sort: { 'indexedMetadata.nft.created': 'desc' },
  aggs: {
    tags: { terms: { field: 'metadata.tags.keyword', size: 10 } }
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg)
}

async function main() {
  console.log('--- DID mapping sanity ---')
  const sample = 'did:op:320153a982d6db2b5bc520f1bcfec11361d15abd6619280e0e04bcb3384c551a'
  assert(didV4toV5(sample).startsWith('did:ope:'), 'did:op -> did:ope')
  assert(didV5toV4(didV4toV5(sample)) === sample, 'round-trips')
  console.log('  ok:', sample, '<->', didV4toV5(sample).slice(0, 20) + '…')

  console.log('\n--- translated query (v4 -> v5) ---')
  const v5Query = rewriteQueryV4toV5(v4Query)
  console.log(JSON.stringify(v5Query, null, 1))

  console.log('\n--- POST to node ---')
  const res = await fetch(`${UPSTREAM}/api/aquarius/assets/metadata/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v5Query)
  })
  console.log('  HTTP', res.status)
  const raw = await res.json()

  const flat = flattenQueryResponse(raw)
  console.log('  totalResults:', flat.totalResults)
  console.log('  returned:', flat.results?.length)

  console.log('\n--- flattened v4 results ---')
  for (const ddo of flat.results || []) {
    assert(ddo.id.startsWith('did:op:'), `id is v4 (${ddo.id})`)
    assert(!ddo.credentialSubject, 'no credentialSubject leaked')
    assert(ddo.metadata && typeof ddo.metadata.name === 'string', 'flat metadata.name')
    assert(
      typeof ddo.metadata.description === 'string',
      'description flattened to string'
    )
    assert(typeof ddo.chainId === 'number', 'flat chainId')
    console.log(
      `  ${ddo.id.slice(0, 18)}…  chain=${ddo.chainId}  "${ddo.metadata.name}"`
    )
  }

  if (flat.aggregations) {
    console.log('\n--- aggregations passed through ---')
    console.log('  keys:', Object.keys(flat.aggregations).join(','))
  }

  console.log('\n✅ ALL CHECKS PASSED — node answered a standard v4 query as v4 DDOs')
}

main().catch((err) => {
  console.error('\n❌', err.message)
  process.exit(1)
})
