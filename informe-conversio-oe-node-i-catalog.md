# Informe de conversio a OE Node i resolucio del cataleg

Data: 5 de juny de 2026

Aquest informe resumeix la feina feta per convertir el node existent d'Ocean Node a OE Node, connectar-lo amb el marketplace privat d'Empower-X i diagnosticar per que els actius publicats no apareixien correctament al cataleg.

## Objectiu

L'objectiu era passar d'un Ocean Node generic a un OE Node compatible amb Ocean Enterprise, mantenint el marketplace privat local funcionant a:

```text
http://localhost:8008
```

i fent que publiqui i llegeixi actius contra el node remot:

```text
http://192.168.130.2:8000
```

## Estat final

L'OE Node esta actiu i indexant correctament a Sepolia.

Comprovacions finals:

```text
OE Node: http://192.168.130.2:8000
Versio: 3.2.1
Chain: Sepolia, chainId 11155111
Owner info: Empower-X
Indexer gap: 0 blocs
Index queue: []
Marketplace local: http://localhost:8008
```

L'Ocean Node anterior ja no esta corrent com a servei actiu. Els contenidors actius relacionats amb el node son:

```text
oe-node
elasticsearch
```

No hi ha cap `ocean-node` ni `typesense` actiu.

## Canvis al servidor del node

Es va crear una instal.lacio separada per a OE Node a:

```text
/home/dumbnode/soft/ocean/oe-node
```

El repositori utilitzat es:

```text
https://github.com/OceanProtocolEnterprise/ocean-node.git
```

La branca utilitzada era `main`, amb versio de paquet `3.2.1`.

El stack nou utilitza:

```text
oceanenterprise/oe-node:latest
docker.elastic.co/elasticsearch/elasticsearch:8.19.3
```

L'antic stack d'Ocean Node es va aturar, pero es van conservar els fitxers i backups per poder consultar configuracio anterior si cal.

## Configuracio aplicada a l'OE Node

Es van crear els fitxers:

```text
/home/dumbnode/soft/ocean/oe-node/.env.node
/home/dumbnode/soft/ocean/oe-node/.env.elasticsearch
```

No s'inclouen secrets en aquest informe.

Els punts rellevants de configuracio son:

```text
DB_TYPE=elasticsearch
DB_URL=http://elasticsearch:9200
IPFS_GATEWAY=https://zertifier.mypinata.cloud
HTTP_API_PORT=8000
INTERFACES=["HTTP","P2P"]
FEE_TOKENS={"11155111":"0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4"}
FEE_AMOUNT={"amount":0,"unit":"MB"}
NODE_OWNER_INFO=Empower-X
```

També es va reusar la mateixa configuracio RPC de Sepolia/Alchemy que ja tenia el node anterior.

## Ajust de l'indexador

Inicialment, l'indexador començava molt enrere a Sepolia i hauria trigat hores a arribar als blocs actuals. Per a un dataspace nou no calia indexar tot l'historic, per tant es va moure el checkpoint prop del tip de Sepolia.

Resultat final:

```text
lastIndexedBlock = networkHeight
gapBlocks = 0
```

Aixo vol dir que els nous `MetadataCreated` es processen practicament al moment.

## Configuracio del marketplace

El marketplace local esta configurat per apuntar a l'OE Node:

```text
NEXT_PUBLIC_PROVIDER_URL=http://192.168.130.2:8000
NEXT_PUBLIC_METADATACACHE_URI=["http://192.168.130.2:8000"]
NEXT_PUBLIC_NODE_URI_INDEXED=["http://192.168.130.2:8000"]
NEXT_PUBLIC_NODE_URI_MAP={"11155111":"https://eth-sepolia.g.alchemy.com/v2/<redacted>"}
NEXT_PUBLIC_DATASPACE=personal-ocean-market
NEXT_PUBLIC_ENCRYPT_ASSET=true
```

La variable `NEXT_PUBLIC_ENCRYPT_ASSET` es va tornar a posar a `true`, perque nomes s'havia desactivat temporalment per provar el comportament amb l'Ocean Node generic.

## Problemes trobats durant la publicacio

### 1. Prefix incorrecte de DID

Durant les proves amb l'Ocean Node es va canviar temporalment el prefix del DID a:

```text
did:op:
```

Per a OE Node i DDO v5, el prefix correcte es:

```text
did:ope:
```

Es va corregir a:

```text
src/components/Publish/_utils.ts
```

La funcio `makeDid()` torna a generar:

```text
did:ope:<hash>
```

### 2. Pestanyes del navegador amb JavaScript antic

Despres de reconstruir el marketplace, algunes publicacions encara sortien amb `did:op:`. La causa mes probable era una pestanya oberta amb el bundle antic carregat en memoria.

La solucio va ser:

```text
Tancar pestanyes antigues
Obrir una pestanya nova
Fer Ctrl+F5 o Ctrl+Shift+R
Publicar de nou
```

### 3. Error "Unsupported DDO version: 5.0.0"

L'OE Node va mostrar aquest error per alguns intents:

```text
Unsupported DDO version: 5.0.0
```

El missatge podia confondre, perque l'OE Node si suporta DDO `5.0.0`. El problema real era la combinacio invalida:

```text
version: 5.0.0
id: did:op:...
```

Per DDO v5, el paquet `@oceanprotocol/ddo-js` de l'OE Node espera:

```text
version: 5.0.0
id: did:ope:...
```

Un cop el marketplace va publicar amb `did:ope:`, l'indexador va acceptar l'actiu.

## Actiu publicat correctament

L'actiu que finalment es va indexar correctament es:

```text
did:ope:4fe9678fdae78a7d7438bcfd4018adff0aab77ac207984ad87ebb938f08c10a4
```

Comprovacions fetes:

```text
GET /api/aquarius/assets/ddo/<did> -> 200
version -> 5.0.0
dataspace -> personal-ocean-market
metadata.type -> dataset
indexedMetadata.nft.state -> 0
serviceEndpoint -> http://192.168.130.2:8000
```

L'OE Node va registrar:

```text
Processed new DDO data did:ope:4fe9678...
Saved or updated DDO: did:ope:4fe9678...
saved DDO: {"_index":"op_ddo_v5.0.0", ...}
```

## Per que no apareixia al cataleg

Encara que l'actiu ja existia al cache, el cataleg no el mostrava. El motiu era la forma de la query Elasticsearch.

OE Node v5 indexa els serveis com a camp nested:

```text
credentialSubject.services
```

El marketplace, pero, estava fent filtres plans sobre camps com:

```text
credentialSubject.services.type
credentialSubject.services.serviceEndpoint.keyword
```

Aixo no retornava resultats, encara que l'actiu existia.

Es va comprovar que la query amb filtres nested si retornava l'actiu.

## Correccio del cataleg

Es va modificar:

```text
src/@utils/aquarius/index.ts
```

Canvis principals:

1. Els filtres sobre `credentialSubject.services.*` ara es generen com a nested queries.
2. El filtre de service endpoint ja no usa:

```text
credentialSubject.services.serviceEndpoint.keyword
```

3. Ara usa:

```text
credentialSubject.services.serviceEndpoint
```

4. El filtre per defecte del node indexat tambe passa per `getFilterTerm()`, de manera que queda embolicat correctament com a nested query.

Despres d'aixo es va reconstruir i reiniciar el marketplace:

```text
docker compose up -d --build
```

El build final va completar correctament i el contenidor `ocean-market` va quedar actiu.

## Estat dels intents fallits

Els DIDs antics no s'han de considerar valids:

```text
did:ope:62b79b7a1567a5f9cd8086393283282b5f0deb04d9014e5e209027a456af276b
did:op:b3069796d29666eb55860a1e7e80aeeacaa5b9b67b1a4d2e5723bd306e0496fb
did:op:5abb06bbb50d8bd8a68edbf99c675464467141a7fa8674caa31360b2c86c26dd
did:op:7a96b5d0ebf57f68078b8dd09666b22882648a080a24895f608cae9b5f367207
did:op:22636913ebed4e32ae078d9429d5ea46e5810f199812a3db8b4e7ef58b519efc
```

Alguns van fallar per prefix incorrecte, altres per haver estat publicats abans que la configuracio OE estigues correcta. No cal intentar recuperar-los.

## Fitxers locals modificats durant aquesta fase

Fitxers principals:

```text
src/components/Publish/_utils.ts
src/@utils/aquarius/index.ts
.env
```

Canvis rellevants:

```text
Publish DID prefix -> did:ope:
Encrypted asset publishing -> true
Catalogue service filters -> nested OE v5 query
Service endpoint filter -> credentialSubject.services.serviceEndpoint
```

## Com provar-ho ara

### Prova directa de l'actiu

Obrir:

```text
http://localhost:8008/asset/did:ope:4fe9678fdae78a7d7438bcfd4018adff0aab77ac207984ad87ebb938f08c10a4
```

Si el navegador encara mostra l'error antic, fer:

```text
Ctrl+F5
```

### Prova de cataleg

Obrir:

```text
http://localhost:8008/search
```

o la pagina principal del marketplace. L'actiu hauria d'apareixer al cataleg.

### Prova de nova publicacio

Per provar de punta a punta:

1. Obrir una pestanya nova.
2. Anar a:

```text
http://localhost:8008/publish/1?fresh=oe
```

3. Fer `Ctrl+F5`.
4. Publicar un dataset petit.
5. Verificar que la URL generada comença per:

```text
did:ope:
```

6. Esperar uns segons i comprovar que apareix al cataleg.

## Pendents i recomanacions

1. Fer una prova neta de publicacio amb un nom real i dades de prova controlades.
2. Validar que l'actiu apareix tant a la pagina de detall com al cataleg.
3. Quan es desplegui en servidor public, substituir `localhost:8008` per un domini real amb HTTPS.
4. Mantenir els secrets fora del repositori: private key, Alchemy key, IPFS JWT i passwords.
5. Documentar el procediment de reinici de l'OE Node i del marketplace.
6. Revisar mes endavant la part de compute si es vol executar algoritmes, perque aixo requerira configurar entorns de compute addicionals.

## Conclusio

La conversio a OE Node esta feta i el node funciona. El problema principal no era que l'OE Node estigues caigut, sino una combinacio de:

```text
DID prefix antic
bundles antics al navegador
queries de cataleg no adaptades a OE v5
```

Un cop corregit el prefix `did:ope:` i adaptats els filtres nested del cataleg, el marketplace queda alineat amb l'estructura d'OE Node v5.
