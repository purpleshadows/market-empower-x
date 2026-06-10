# Informe del mercat privat Ocean Enterprise

Data: 4 de juny de 2026

Aquest document resumeix la feina feta per posar en marxa un mercat privat basat en Ocean Enterprise Market, connectar-lo al node existent, provar la publicacio d'actius i diagnosticar per que els actius no apareixen al cataleg.

No s'hi inclouen secrets. Les claus privades, el JWT d'IPFS, la contrasenya SSH i la clau d'Alchemy queden expressament fora d'aquest informe.

## Objectiu

L'objectiu era tenir un mercat propi, o dataspace privat, basat en Ocean Enterprise Market. Ja existia un node funcionant a la maquina remota `192.168.130.2`, pero aquest node era un Ocean Node normal, no un OE Node. La idea inicial era comprovar si el mercat podia funcionar amb aquest node i, si no, preparar la migracio cap a un OE Node.

## Estat inicial

La maquina local es Windows, amb WSL2 i Docker instal.lats. El mercat s'ha treballat dins de:

```text
C:\Users\tudor\Documents\Ocean Market
```

El node remot existent respon a:

```text
http://192.168.130.2:8000
```

El mercat local s'executa a:

```text
http://localhost:8008
```

El node remot detectat es:

```text
software: Ocean-Node
version: 3.2.0
chainIds: ["11155111"]
network: Sepolia
```

El `11155111` es el chain ID de Sepolia, la xarxa de test d'Ethereum que s'esta fent servir.

## Posada en marxa del mercat

Es va preparar el projecte local del mercat Ocean Enterprise i es va configurar Docker per servir-lo com a aplicacio local. El contenidor del mercat es diu:

```text
ocean-market
```

La imatge local es:

```text
personal-data-market:local
```

El fitxer `docker-compose.yml` exposa el mercat al port `8008` i carrega les variables des de `.env`.

També es va afegir un `.dockerignore` per evitar enviar al build fitxers innecessaris.

## Problema inicial: pagina en blanc

Al principi el mercat carregava pero la pagina quedava en blanc. El problema venia de la configuracio de xarxes i del comportament del client quan no trobava una cadena suportada de manera directa.

Es van fer dues correccions al frontend:

1. A `src/@utils/wallet/index.ts`, es va afegir un fallback per obtenir les cadenes suportades a partir de la configuracio real abans de caure a localhost.

2. A `src/@context/UrqlProvider.tsx`, es va afegir un fallback per fer servir la xarxa Ocean configurada quan la cadena preferida no tenia configuracio disponible.

Despres d'aixo, el frontend va deixar d'apareixer en blanc i el mercat va començar a mostrar contingut visualment.

## Configuracio principal del mercat

El mercat es va configurar per apuntar al node remot existent. Les variables importants van quedar aixi, amb secrets redactats:

```env
NEXT_PUBLIC_PROVIDER_URL=http://192.168.130.2:8000
NEXT_PUBLIC_METADATACACHE_URI=["http://192.168.130.2:8000"]
NEXT_PUBLIC_NODE_URI_INDEXED=["http://192.168.130.2:8000"]
NEXT_PUBLIC_NODE_URI_MAP={"11155111":"https://eth-sepolia.g.alchemy.com/v2/<redacted>"}
NEXT_PUBLIC_IPFS_GATEWAY=https://zertifier.mypinata.cloud
NEXT_PUBLIC_IPFS_UPLOAD_URL=https://api.pinata.cloud/pinning/pinJSONToIPFS
NEXT_PUBLIC_IPFS_DELETE_URL=https://api.pinata.cloud/pinning/unpin
NEXT_PUBLIC_DATASPACE=personal-ocean-market
NEXT_PUBLIC_SSI_ENABLED=false
NEXT_PUBLIC_ENCRYPT_ASSET=false
```

També es va configurar el token ERC20 permes per Sepolia:

```env
NEXT_PUBLIC_ALLOWED_ERC20_ADDRESSES={"11155111":["0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4"]}
```

## IPFS i Pinata

Es va aclarir que el JWT d'IPFS no es el mateix que un CID.

El JWT d'IPFS es una credencial d'autenticacio per poder pujar o esborrar contingut al proveidor IPFS, en aquest cas Pinata. En canvi, el CID es l'identificador public d'un fitxer o objecte ja pujat a IPFS.

La gateway publica configurada es:

```text
https://zertifier.mypinata.cloud
```

En `NEXT_PUBLIC_IPFS_GATEWAY` nomes cal posar la gateway base. No cal afegir `/ipfs/CID` dins la variable. El patró `/ipfs/<CID>` l'afegeix el codi quan ha de recuperar un objecte concret.

Es va provar la pujada i eliminacio d'un objecte de prova a IPFS mitjançant l'API local del mercat, i la prova va funcionar.

## Connexio amb el node remot

Es va accedir a la maquina remota del node per SSH i es va comprovar que hi havia un stack Docker amb:

```text
ocean-node
typesense
policy servers
postgres
caddy
altres serveis auxiliars
```

El node `ocean-node` exposa:

```text
http://192.168.130.2:8000
```

Typesense respon a:

```text
http://192.168.130.2:8108
```

El node remot fa servir Sepolia amb Alchemy com a RPC. La mateixa xarxa i RPC es van reflectir al mercat mitjançant `NEXT_PUBLIC_NODE_URI_MAP`.

## Primera publicacio: problema amb `did:ope`

Una de les primeres publicacions va generar un asset amb DID:

```text
did:ope:62b79b7a1567a5f9cd8086393283282b5f0deb04d9014e5e209027a456af276b
```

Pero el node normal Ocean Node nomes accepta identificadors amb prefix:

```text
did:op:
```

El codi del node remot no tenia suport per `did:ope`. Es va confirmar inspeccionant el codi del contenidor `ocean-node`: les rutes Aquarius i la validacio de DDO exigien `did:op`.

Per tant, es va corregir el mercat local:

1. A `src/components/Publish/_utils.ts`, la funcio de generacio del DID es va canviar de `did:ope:` a `did:op:`.

2. A `src/@utils/ddo.ts`, la validacio local del DID es va relaxar per acceptar tant `did:op:` com `did:ope:`, de manera que el mercat pugui llegir actius antics o nous sense trencar-se.

Despres d'aquesta correccio, els nous actius publicats ja feien servir `did:op:`.

## Prova d'algoritme de mostra

Es va crear un algoritme de mostra al mercat local:

```text
public/samples/word-count.py
```

L'algoritme compta linies, paraules i bytes dels fitxers d'entrada i escriu un resum en JSON.

URL local:

```text
http://localhost:8008/samples/word-count.py
```

URL accessible des del node remot:

```text
http://192.168.130.61:8008/samples/word-count.py
```

El node remot va poder validar el fitxer mitjançant l'endpoint `fileInfo`. La resposta va indicar que el fitxer era valid:

```json
[
  {
    "valid": true,
    "contentLength": "1701",
    "contentType": "application/octet-stream",
    "type": "url"
  }
]
```

Aixo confirma que el node remot pot accedir a fitxers servits pel mercat local, almenys dins la xarxa local.

## Segona publicacio: DID correcte pero error de desxifrat

Despres de corregir el prefix DID, es va publicar un nou actiu:

```text
did:op:b3069796d29666eb55860a1e7e80aeeacaa5b9b67b1a4d2e5723bd306e0496fb
```

El node va veure la transaccio, pero va marcar l'actiu com invalid:

```text
valid: false
error: Provider exception on decrypt DDO. Status: Request failed with status code 500
```

Aixo indicava que el problema del prefix ja estava resolt, pero el node no podia desxifrar o processar el DDO publicat pel mercat.

En aquell moment el mercat encara tenia:

```env
NEXT_PUBLIC_ENCRYPT_ASSET=true
```

Per provar si el problema era nomes el xifrat del DDO, es va canviar a:

```env
NEXT_PUBLIC_ENCRYPT_ASSET=false
```

Despres es va reconstruir i reiniciar el contenidor:

```text
docker compose up -d --build
```

I es va verificar que el navegador realment rebia:

```text
NEXT_PUBLIC_ENCRYPT_ASSET=false
```

## Tercera publicacio: xifrat desactivat, pero encara falla

Amb el xifrat desactivat, es va publicar un ultim actiu de prova:

```text
did:op:5abb06bbb50d8bd8a68edbf99c675464467141a7fa8674caa31360b2c86c26dd
```

El node tambe el va veure, pero el va marcar invalid:

```text
valid: false
nft: 0x81a1Dd8568B978623aa61249A6656262b40163FE
txId: 0xd0fb9db62d78dc6053efe931bbc30e7c55b48b7e052bd65c9658aa67fa632434
error: Cannot read properties of undefined (reading 'startsWith')
```

La consulta directa del DDO va retornar `404`, i la consulta al cataleg/cache no va retornar cap resultat.

Els logs del node van confirmar que el `MetadataCreated` s'havia rebut, pero el processament del metadata va fallar:

```text
INDEXER: -- MetadataCreated -- triggered
INDEXER: Error processMetadataEvents ... TypeError: Cannot read properties of undefined (reading 'startsWith')
INDEXER: Missing event data (ddo) for MetadataCreated
```

Aixo demostra que el problema no es simplement que el cataleg trigui a actualitzar-se. El node rep l'esdeveniment on-chain, intenta processar-lo i falla abans d'escriure el DDO a cache.

## Estat del cache i Typesense

Es va comprovar que les col.leccions de Typesense existien, pero no tenien documents DDO indexats per aquests actius.

També apareixien errors de schema quan el mercat feia consultes esperant camps propis del model OE, com ara:

```text
indexedMetadata.nft.owner
credentialSubject.dataspace
consumer.keyword
```

Aixo reforça la conclusio que el mercat OE esta esperant una estructura d'indexacio que el node Ocean normal no esta proporcionant correctament.

## Conclusio tecnica

Les proves han descartat els problemes mes probables:

1. El mercat ja no queda en blanc.

2. El mercat apunta al node remot correcte.

3. El provider, el cache i el node apunten al mateix endpoint base:

```text
http://192.168.130.2:8000
```

4. El chain ID de Sepolia esta configurat correctament com `11155111`.

5. El problema del prefix `did:ope` es va corregir i els nous actius ja fan servir `did:op`.

6. La prova amb `NEXT_PUBLIC_ENCRYPT_ASSET=false` descarta que el problema sigui nomes el xifrat.

7. El node veu les transaccions on-chain, pero falla processant la metadata abans d'indexar el DDO.

La conclusio es que el backend actual, que es un Ocean Node normal, no es prou compatible amb el format de publicacio i indexacio del mercat Ocean Enterprise. El mercat OE publica metadata amb estructura OE, credencials/signatures i camps de dataspace que el node normal no esta indexant be.

Per tant, el seguent pas raonable es migrar el backend a un OE Node.

## Que cal fer a continuacio

### 1. Convertir o substituir el node actual per un OE Node

Cal preparar un OE Node en lloc del `ocean-node` normal. Es pot fer de dues maneres:

1. Convertir la maquina remota actual, reutilitzant el servidor `192.168.130.2`.

2. Crear una instal.lacio nova i neta d'OE Node i despres apuntar-hi el mercat.

La segona opcio sol ser mes neta si el stack actual ja te estat, indexacio parcial i serveis barrejats.

### 2. Reutilitzar la configuracio bona

La configuracio que sembla correcta i que s'hauria de reutilitzar al nou OE Node:

```text
Sepolia chain ID: 11155111
RPC Sepolia: Alchemy, amb la clau actual redactada
Provider/network endpoint esperat pel mercat: port 8000
Gateway IPFS recomanada: https://zertifier.mypinata.cloud
Dataspace: personal-ocean-market
```

### 3. Revisar IPFS gateway al node

El node actual tenia configurada la gateway IPFS:

```text
https://ipfs.io/
```

Per coherencia amb Pinata, seria millor configurar el backend OE amb:

```text
https://zertifier.mypinata.cloud
```

Aixo evita que el mercat pugi metadata a Pinata pero el node intenti recuperar-la des d'una gateway publica diferent.

### 4. Connectar el mercat al nou OE Node

Quan el nou OE Node estigui disponible, cal actualitzar el `.env` local del mercat:

```env
NEXT_PUBLIC_PROVIDER_URL=http://<OE_NODE_HOST>:8000
NEXT_PUBLIC_METADATACACHE_URI=["http://<OE_NODE_HOST>:8000"]
NEXT_PUBLIC_NODE_URI_INDEXED=["http://<OE_NODE_HOST>:8000"]
```

Si es manté la mateixa IP i port, probablement aquests valors no hauran de canviar:

```env
NEXT_PUBLIC_PROVIDER_URL=http://192.168.130.2:8000
NEXT_PUBLIC_METADATACACHE_URI=["http://192.168.130.2:8000"]
NEXT_PUBLIC_NODE_URI_INDEXED=["http://192.168.130.2:8000"]
```

### 5. Reconstruir i reiniciar el mercat

Despres de tocar `.env`, cal reiniciar el contenidor del mercat:

```text
docker compose up -d --build
```

I verificar:

```text
http://localhost:8008/runtime-config.js
```

### 6. Publicar un actiu petit de prova

Quan el backend OE estigui actiu, cal publicar un actiu molt simple. Millor no gastar mes transaccions en proves grans fins que el cache funcioni.

La comprovacio correcta despres de publicar es:

1. El DID ha de ser `did:op:<hash>`.

2. L'endpoint de state ha de dir `valid: true`.

3. L'endpoint DDO ha de retornar l'asset, no `404`.

4. La consulta al cataleg ha de retornar almenys un resultat.

5. La pagina del mercat `/asset/<did>` ha de carregar.

## Estat actual final

El mercat local funciona visualment i carrega a:

```text
http://localhost:8008
```

La configuracio del mercat apunta al node remot:

```text
http://192.168.130.2:8000
```

El cataleg continua buit perque el node no indexa correctament els actius publicats pel mercat OE.

L'ultim asset publicat amb xifrat desactivat tambe ha fallat, cosa que confirma que el problema principal no es la configuracio local del mercat, sino la compatibilitat del backend.

El proper pas recomanat es posar en marxa un OE Node i despres tornar a provar una publicacio petita.

