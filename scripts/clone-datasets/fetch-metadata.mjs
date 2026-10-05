/**
 * Stage 1 of cloning the 16 empower-x demo datasets into your marketplace.
 *
 * Reads each source DDO from the Ocean Enterprise stage node (vm2) and writes
 * a datasets.json with the copyable metadata for each one, plus an empty
 * "sourceUrl" you fill in with the real data endpoint (the original files
 * field is encrypted and cannot be recovered from the published DDO).
 *
 * No wallet or dependencies needed — uses Node 18+ global fetch.
 *
 * Usage:
 *   cd scripts/clone-datasets
 *   node fetch-metadata.mjs
 *   -> writes datasets.json
 */

import { writeFile } from 'node:fs/promises'

// Datasets are split across the two stage nodes; try both.
const SOURCE_NODES = [
  'https://ocean-node-vm2.oceanenterprise.io',
  'https://ocean-node-vm3.oceanenterprise.io'
]

async function fetchDdo(did) {
  let lastErr
  for (const node of SOURCE_NODES) {
    try {
      const res = await fetch(`${node}/api/aquarius/assets/ddo/${did}`)
      if (res.ok) return await res.json()
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

// Datasets from https://docs.empower-x.io/casos/ plus 3 C2D datasets.
// [title, source DID, real data-source URL ('' = unknown)]
const RAW = 'http://46.253.45.22:2106/raw/by-name/'
const SOURCE = [
  ['Energy Consumption and Generation (hourly, by month)', 'did:ope:bab845f238ef9a7a80587d462eaa94fc185c20fdd31b817d7dec59903d58d6c3', ''],
  ['Pumping Stations & Water Infrastructure', 'did:ope:633d9ebdea4092abc8c59f1b99a447cacf66ad1d460d911d0c2497fecdbb3c63', RAW + 'pump_stations'],
  ['Underground Waste Containers', 'did:ope:ed18d26e25a8c509f152254b7c96797431920554e7bd5af46ff9f2e311e35944', RAW + 'underground_waste'],
  ['Cultural Buildings & Heritage', 'did:ope:81e3ed9bee43baa1abd4077497d403ac926c3cd32313a0fa5339cdcff9fac9be', RAW + 'cultural_buildings'],
  ['Educational Facilities', 'did:ope:ebcd8844ba9c0e1a9cde7ac6e9d732ae25890c8f7b3cf5c25352de9b9a32044e', RAW + 'education_facilities'],
  ['Public Street Lighting', 'did:ope:301dd6a116fdfef4a6b82f8255893b6c63be20c5d830aaae4b4c412f10d0caf8', RAW + 'street_lighting'],
  ['Sports Facilities', 'did:ope:31643222a8ec7babaa95096da069b40be0b3497b98101ddb7077b6f445cf47dd', RAW + 'sports_facilities'],
  ['Mixed-Use Buildings', 'did:ope:b9b9fd8d5da852139788b00044212c657ab222bde631b539d3989042b95d5a6d', RAW + 'mixeduse_buildings'],
  ['Office & Administrative Buildings', 'did:ope:9e63e5dd09e2ff044b937e39c6d7758d05c24b825c6562dd54a2882ae94b7610', RAW + 'office_buildings'],
  ['Swimming Pool Facilities', 'did:ope:2f4058b3ff4063c864497930a27b83ea944fcaeb4fb88b4ea650062a725fea04', RAW + 'swimming_pools'],
  ['Healthcare & Sanitary Buildings', 'did:ope:d58a7e0bda38d9222cfc8ce394d6f8a3261ed6dc7bb49f43bff240be92057a6a', RAW + 'healthcare_buildings'],
  ['Traffic Lights & Signaling', 'did:ope:c02b6f40c3d5b091db16d2752de8f71850d58f4a5c6cff25336a48c6a539fc47', RAW + 'traffic_lights'],
  ['Solar Inverter Monitoring (Bettergy)', 'did:ope:213b35870fc56abe505c91887221cefa6accc419d31840cb995b6728df869ee2', RAW + 'monitorizacion_y_gestion_de_inversores'],
  ['Hourly Electricity Prices (Soy Eficiente)', 'did:ope:ef1b1d1ef16a555d572de3c48828ad773cbd9a457708843f5b4479e63b5aabd4', RAW + 'precios_de_la_luz_por_tarifa'],
  ['Energy Production/Consumption + Solar (Badalona)', 'did:ope:57faa605004cf42ed6eeeebb5541945f3622b6cadfbb3f2ad7627feae2e6f235', RAW + 'prod_cons_viladebadalona'],
  ['Annual Photovoltaic Performance (Naturelek)', 'did:ope:c1e3311cc026d2d2261c6cd9aae7a08ccb46cb32197aba97494d8f570e241acb', RAW + 'rendimiento_fotovoltaico'],
  // --- C2D datasets ---
  ['Sommobilitat Data (EV charges)', 'did:ope:5d70e0ec4bc86527310ad8e6e4391c1532ac34cd69d4070acc73cd6c0cf1cb3e', RAW + 'cars_rubi_ds4ped'],
  ['Etecnic Data (EV chargers)', 'did:ope:85e105878ac8088b7d5ed3c440e958abdb6b791ae54a8f8e8ce15369e33b724d', RAW + 'chargers_rubi_ds4ped'],
  ['PV Production (solar surplus ZP)', 'did:ope:25d0778c454d922ea66dded04f924b1ce71eef3e24566ba4a743909f32fa28ed', RAW + 'surplus_rubi_ds4ped']
]

// English name + description from https://docs.empower-x.io/casos/ (English is the
// site's default language). These override the source DDO's Spanish text so the
// published assets read in English. Keyed by DID. The 3 C2D datasets are not on
// that page and are already in English, so they are intentionally absent here.
const ENGLISH = {
  'did:ope:bab845f238ef9a7a80587d462eaa94fc185c20fdd31b817d7dec59903d58d6c3': {
    name: 'Energy Consumption and Generation Dataset',
    description:
      'Private, non-downloadable dataset with hourly data (filtered by month) for consumption, generation, and exports'
  },
  'did:ope:633d9ebdea4092abc8c59f1b99a447cacf66ad1d460d911d0c2497fecdbb3c63': {
    name: 'Pumping stations and water-related infrastructure',
    description:
      'Monitor and optimize energy consumption of drinking water and wastewater pumping stations'
  },
  'did:ope:ed18d26e25a8c509f152254b7c96797431920554e7bd5af46ff9f2e311e35944': {
    name: 'Underground waste container systems',
    description:
      'Energy-efficient management of underground waste container systems through IoT sensor integration'
  },
  'did:ope:81e3ed9bee43baa1abd4077497d403ac926c3cd32313a0fa5339cdcff9fac9be': {
    name: 'Cultural buildings such as museums, heritage sites, and community centers',
    description:
      'Preserving heritage with smart energy management that balances strict conservation requirements'
  },
  'did:ope:ebcd8844ba9c0e1a9cde7ac6e9d732ae25890c8f7b3cf5c25352de9b9a32044e': {
    name: 'Educational facilities including schools and training centers',
    description:
      'Empowering sustainability in education through real-time tracking of energy usage in schools'
  },
  'did:ope:301dd6a116fdfef4a6b82f8255893b6c63be20c5d830aaae4b4c412f10d0caf8': {
    name: 'Public street lighting points and lighting-related installations',
    description:
      'Smart public lighting networks that transform urban infrastructure into adaptive systems'
  },
  'did:ope:31643222a8ec7babaa95096da069b40be0b3497b98101ddb7077b6f445cf47dd': {
    name: 'Sports facilities like gyms, fields, and athletic centers',
    description:
      'High-performance energy management for sports facilities with intensive and variable demands'
  },
  'did:ope:b9b9fd8d5da852139788b00044212c657ab222bde631b539d3989042b95d5a6d': {
    name: 'Mixed-use buildings with combined purposes',
    description:
      'Integrated energy profiles for mixed-use buildings that combine housing, offices, shops, and services'
  },
  'did:ope:9e63e5dd09e2ff044b937e39c6d7758d05c24b825c6562dd54a2882ae94b7610': {
    name: 'Office buildings and administrative municipal spaces',
    description:
      'Efficient public administration through intelligent monitoring and control of energy use'
  },
  'did:ope:2f4058b3ff4063c864497930a27b83ea944fcaeb4fb88b4ea650062a725fea04': {
    name: 'Indoor and outdoor swimming pool facilities',
    description: 'Thermal energy optimization for indoor and outdoor pool facilities'
  },
  'did:ope:d58a7e0bda38d9222cfc8ce394d6f8a3261ed6dc7bb49f43bff240be92057a6a': {
    name: 'Healthcare and sanitary service buildings',
    description:
      'Reliability and efficiency in critical healthcare infrastructure requiring uninterrupted 24-hour electrical supply'
  },
  'did:ope:c02b6f40c3d5b091db16d2752de8f71850d58f4a5c6cff25336a48c6a539fc47': {
    name: 'Traffic light and signaling system installations',
    description:
      'Urban flow efficiency through intelligent management of traffic lights and road signaling systems'
  },
  'did:ope:213b35870fc56abe505c91887221cefa6accc419d31840cb995b6728df869ee2': {
    name: 'Solar Inverter Monitoring and Management',
    description:
      'Secure access to technical and telemetric data from solar inverters in photovoltaic plants'
  },
  'did:ope:ef1b1d1ef16a555d572de3c48828ad773cbd9a457708843f5b4479e63b5aabd4': {
    name: 'Hourly Electricity Prices by Tariff',
    description:
      'Structured access to the hourly components of electricity prices in the Spanish market'
  },
  'did:ope:57faa605004cf42ed6eeeebb5541945f3622b6cadfbb3f2ad7627feae2e6f235': {
    name: 'Energy Production and Consumption Analysis with Solar Generation',
    description:
      'Base data service for the execution of advanced energy analysis algorithms'
  },
  'did:ope:c1e3311cc026d2d2261c6cd9aae7a08ccb46cb32197aba97494d8f570e241acb': {
    name: 'Annual Photovoltaic Performance Analysis',
    description:
      'Dataset of hourly annual energy production for five photovoltaic self-consumption plants'
  }
}

function pick(ddo, label, sourceUrl) {
  const cs = ddo.credentialSubject || {}
  const meta = cs.metadata || {}
  const svc = (cs.services && cs.services[0]) || {}
  const price = (cs.stats && cs.stats.price) || {}
  const en = ENGLISH[ddo.id] || {}
  return {
    label,
    sourceDid: ddo.id,
    sourceUrl, // real data endpoint ('' = still unknown)
    name: en.name || meta.name || '',
    type: meta.type || 'dataset',
    description:
      en.description ||
      (meta.description && (meta.description['@value'] ?? meta.description)) ||
      '',
    author: meta.author || '',
    tags: meta.tags || [],
    license: meta.license || null,
    serviceType: svc.type || 'access', // original access type (often "compute")
    timeout: svc.timeout ?? 0,
    price: {
      value: price.value ?? 0,
      tokenSymbol: price.tokenSymbol || 'OCEAN'
    }
  }
}

async function main() {
  const out = []
  for (const [label, did, sourceUrl] of SOURCE) {
    process.stdout.write(`fetching ${label} … `)
    try {
      const ddo = await fetchDdo(did)
      out.push(pick(ddo, label, sourceUrl))
      console.log(sourceUrl ? 'ok' : 'ok (no sourceUrl)')
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
      out.push({ label, sourceDid: did, sourceUrl, error: err.message })
    }
  }

  const missing = out.filter((d) => !d.sourceUrl && !d.error)
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} still missing a sourceUrl:`)
    missing.forEach((d) => console.log(`   - ${d.label}`))
  }

  await writeFile('datasets.json', JSON.stringify(out, null, 2))
  console.log(`\nWrote datasets.json with ${out.length} entries.`)
  console.log('Next: fill in each "sourceUrl" with the real data endpoint.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
