# Informe d'actualització a Ocean Enterprise v1.5.2 i desplegament SSI

Data: 7 d'octubre de 2026

Aquest informe resumeix la feina feta sobre el marketplace Empower-X entre el 5 i el 7 d'octubre de 2026: l'anàlisi dels canvis pendents, l'actualització a la versió v1.5.2 del repositori original d'Ocean Enterprise, les correccions posteriors al desplegament i la posada en marxa de la infraestructura SSI (identitat autosobirana) per controlar l'accés als actius amb credencials verificables.

## Resum

| Tema | Estat |
|---|---|
| Còpia de seguretat de tota la feina local | Fet |
| Actualització a upstream v1.5.2 | Fet, publicat a `main` i a Docker Hub |
| Versió visible al peu de pàgina | Fet, publicat |
| Errors de la consola (compute jobs, 404 Pontus-X) | Fet, publicat |
| Error 404 en iniciar un càlcul (compute) | Corregit, pendent de publicar |
| Serveis SSI al servidor del node | Reactivats |
| Paquet SSI per a Portainer (`deploy/ssi/`) | Fet i provat de punta a punta en local, pendent de publicar i desplegar |

## 1. Anàlisi dels canvis pendents

Abans de l'actualització hi havia 30 fitxers modificats i 15 de nous sense desar a git (federació amb Pontus-X, pont v4/v5, imatge Empower-X, millores de publicació, scripts). La compilació TypeScript i el lint no donaven errors. Les troballes principals van ser:

- **Clau d'API d'Alchemy escrita al codi** (`scripts/hide-assets/hide-assets.mjs`) i també a `variables.txt`, que ja és a l'historial de git. **Cal rotar-la a Alchemy.**
- **Filtre amb `.keyword` duplicat** a `getFilterTerm`: algunes consultes als nodes de Pontus-X no retornaven res. Corregit.
- **Marcador v4 controlat pel publicador**: qualsevol publicador podia marcar un actiu com a "v4 pont" i fer que el marketplace se saltés la comprovació de credencials al navegador (el node continua comprovant-ho).
- **Contingut Empower-X visible en altres marques** (polítiques de privacitat, etiquetes d'origen, variables CSS), enllaços de peu de pàgina provisionals i imatges allotjades a Google.
- **Pont v4 obert** al port 8092 a totes les interfícies.

## 2. Còpia de seguretat

Abans de tocar res es van guardar tots els canvis de tres maneres:

- Branca git `backup/pre-v1.5.2` amb tota la feina local.
- `Documents/OceanMarket-backup-2026-10-05.tar.gz` i `.patch` amb els 60 fitxers originals.
- La clau d'Alchemy es va substituir per un RPC públic abans de desar-ho a git (el tar conserva l'original).

## 3. Actualització a Ocean Enterprise v1.5.2

El nostre repositori és un fork d'`OceanProtocolEnterprise/market`. La darrera sincronització era del 29 de juny; l'original havia avançat **154 commits** fins a la v1.5.2 (25 de setembre).

### Què aporta la v1.5.2

- `@oceanprotocol/lib` 9.0 i `ddo-js` 1.0.
- Escrow per als pagaments de càlcul (compute).
- Estats del cicle de vida dels actius (fi de vida, no llistat…).
- Comprovació d'etiquetes i checksums d'imatges Docker per als algorismes.
- Camps nous: titular dels drets d'autor (*Copyright Holder*) i enllaços.
- Consentiment de galetes reforçat i analítica PostHog opcional (desactivada si no hi ha clau).
- Correccions de SSI, servidor de polítiques i inici de sessió.

### Com s'ha fet la fusió

La fusió es va fer en una branca a part (`merge/upstream-v1.5.2`) i es va resoldre fitxer per fitxer amb aquest criteri: **si la versió original és millor, s'agafa; si no, es manté la nostra**.

- **S'ha agafat l'original** on ja feia el mateix que nosaltres però millor: fitxa de l'actiu (*Provided By*, truncat, llicència segura, cobrador de pagaments) i camps editables.
- **S'ha mantingut el nostre**: federació amb Pontus-X, pont v4, imatge Empower-X, sanejador JSON-LD, solució de càlcul gratuït.
- **S'han combinat**: la política de privacitat Empower-X amb la nova secció de galetes, i la política de galetes Empower-X amb l'inventari real de galetes de l'original.
- **Ajustos posteriors**: enllaços del peu a les marques, actius v4 exclosos de la nova comprovació de servidor de polítiques, i `validUntil` substituït per `maxJobDuration` (lib 9.0).

### Verificació

- Compilació TypeScript: sense errors. Lint: 0 errors.
- Compilació de producció: correcta.
- Tests: 25 de 42 suites fallen, **exactament igual** que en una còpia neta de la v1.5.2 (problemes propis de l'original amb Node 26 i mocks antics), per tant la fusió no ha trencat cap test.

### Publicació

- Commit `2bd898a3` a `main`, publicat a GitHub.
- Imatge Docker `purpleshadows/market-empower-x:latest` i `:v1.5.2-20261006`.

## 4. Correccions posteriors

- **Versió al peu de pàgina**: el peu mostra ara `· v1.5.2`, llegit de `package.json` en compilar (commit `b9c5b567`, publicat).
- **Error "Cannot read properties of null (reading 'forEach')"** a la llista de càlculs: la lib 9.0 retorna la resposta del node tal qual i, si el node respon `null`, el marketplace fallava. Ara es tolera i un node que falla ja no amaga els treballs de la resta (publicat).
- **Errors 404 de Pontus-X a la consola**: són normals (l'actiu és al nostre node, no al de Pontus-X); ara es registren sense marcar-los com a error (publicat).
- **Errors 401 de DFNS i signer-server**: normals quan no s'ha iniciat sessió amb aquests mètodes. No cal fer res.
- **Error 404 en iniciar un càlcul** (`PolicyServerPassthrough`): el marketplace tornava a comprovar la sessió SSI fins i tot per a actius sense regles SSI, i el node, sense servidor de polítiques, responia 404. Corregit al càlcul i a la descàrrega. **Pendent de publicar.**

## 5. SSI: control d'accés amb credencials

### Què és i per què

L'SSI permet que un proveïdor de dades digui "només poden accedir-hi qui tingui la credencial X" (per exemple, ser membre del consorci Empower-X). És la diferència principal d'Ocean *Enterprise* respecte a l'Ocean estàndard. Fins ara no s'utilitzava: tots els actius permeten qualsevol adreça i la infraestructura estava a mig muntar.

### Compatibilitat de versions

Segons la matriu de compatibilitat d'Ocean Enterprise, **el marketplace v1.5.2 està pensat per al node v4.2.1**, i el nostre node és el **3.2.1**. Funciona, però els falta una generació. Per això el servidor de polítiques es fixa a la versió **v1.3.2**, la darrera compatible amb el node 3.x. Actualitzar el node a 4.2.1 queda com a tasca futura (cal tornar a aplicar els pegats del node).

### Estat al servidor del node (192.168.130.2)

- Els serveis walt.id (cartera, verificador, emissor, interfícies, OPA) **estaven aturats des de feia dos mesos** perquè no tenien política de reinici. S'han tornat a engegar amb reinici automàtic.
- El repositori `waltid-identity` s'ha actualitzat a la darrera versió de la branca `OE`. Les modificacions locals s'han mogut a un fitxer `docker-compose.override.yml` perquè no entrin en conflicte en futures actualitzacions. Còpies de seguretat `*.bak-<data>`.
- OPA necessita ara un certificat TLS: s'ha generat un d'autosignat (només el fa servir el verificador internament).
- L'emissor 0.15.1 (i també el 0.16.2) **falla en arrencar** per unes dates de certificats d'exemple escrites al codi de walt.id que han caducat el 2026. S'utilitza la versió **0.23.2**.
- No es van poder fer dos canvis perquè el sistema de permisos els va bloquejar (exposar la cartera a internet al nginx del servidor i fixar la versió del servidor de polítiques). Per això es va optar per desplegar-ho tot amb Portainer.

### Paquet per a Portainer (`deploy/ssi/`)

S'ha creat una carpeta al repositori amb tot el necessari per desplegar l'SSI com a stacks de Portainer, sense fitxers al servidor:

| Fitxer | Contingut |
|---|---|
| `docker-compose.yml` | **Stack principal** (el que cal desplegar) |
| `docker-compose.tools.yml` | Stack opcional per emetre credencials (emissor + portal d'administració, només LAN) |
| `config/` | Plantilles de configuració de walt.id, que un contenidor d'inici omple amb els valors i secrets |
| `stack.env.example` | Variables a posar a Portainer |
| `scripts/generate-secrets.mjs` | Genera les claus pròpies de cada desplegament |
| `README.md` | Passos de desplegament |

El stack principal inclou:

| Servei | Funció | Accés |
|---|---|---|
| `wallet-gateway` | Entrada pública `https://wallet.zdevutils.com` | Internet (nginx-proxy + Let's Encrypt) |
| `wallet-api` | Cartera: inici de sessió amb MetaMask, guarda credencials | Via passarel·la `/wallet-api/` |
| `waltid-demo-wallet` | Web de la cartera, on l'usuari accepta credencials | Via passarel·la `/` |
| `postgres` | Base de dades de la cartera | Intern |
| `verifier-api` | Verifica les credencials presentades | Intern |
| `opa-server` | Motor de polítiques del verificador | Intern |
| `policy-server` | Decideix si es permet l'accés, a petició del node | LAN (port 8001) |
| `policy-server-proxy` | Rep les presentacions de la cartera | Intern |
| `ssi-config` | Escriu la configuració en arrencar i s'atura | — |

Les adreces públiques (`wallet.zdevutils.com`, `market-empower-x.zdevutils.com`, `node.zdevutils.com`) estan escrites directament al compose, com als altres projectes. A Portainer només cal posar `LETSENCRYPT_EMAIL`, els secrets generats i, opcionalment, la IP de LAN per al servidor de polítiques.

**Seguretat:** les configuracions originals de walt.id porten claus de signatura públiques a GitHub, amb les quals qualsevol podria falsificar sessions de la cartera. El paquet genera claus pròpies per a cada desplegament.

### Prova de punta a punta

El stack es va provar en local amb Docker i **tot el flux funciona**:

1. Un emissor crea una credencial i una cartera (inici de sessió tipus MetaMask) l'accepta.
2. El servidor de polítiques obre una sessió per a un actiu que exigeix aquesta credencial.
3. La cartera resol la petició, troba la credencial i la presenta.
4. El verificador l'accepta i redirigeix a la pàgina `/success` del marketplace.
5. El servidor de polítiques confirma la sessió verificada.

També es va comprovar que **una cartera sense la credencial és rebutjada**. Durant la prova es va confirmar que el proxy del servidor de polítiques parla amb el servidor a través del node, per tant **connectar el node al servidor de polítiques és imprescindible**.

### Canvis al marketplace per a l'SSI

- El servidor de polítiques exigeix una sessió per a **totes** les descàrregues, també per als actius sense regles SSI. El marketplace ara detecta si el node té servidor de polítiques: si no en té, funciona com avui; si en té, obre la sessió (que s'aprova a l'instant per als actius sense credencials).
- El `docker-compose.yml` del marketplace passa ara `NEXT_PUBLIC_SSI_WALLET_API` i `NEXT_PUBLIC_SSI_UI_URL`.
- Aquests canvis estan **pendents de publicar**.

## 6. Passos pendents

1. **Publicar** els canvis pendents (SSI, correcció del 404 de càlcul) a GitHub i construir una imatge nova del marketplace.
2. **DNS**: crear `wallet.zdevutils.com` apuntant al servidor del marketplace (si no hi ha un comodí `*.zdevutils.com`).
3. **Portainer**: afegir el stack amb el repositori, ruta `deploy/ssi/docker-compose.yml`, i les variables.
4. **Node**: afegir `POLICY_SERVER_URL=http://<IP-LAN-del-servidor>:8001` i recrear el node. El node ha de poder arribar al servidor del marketplace per aquest port.
5. **Marketplace**: posar `NEXT_PUBLIC_SSI_WALLET_API` i `NEXT_PUBLIC_SSI_UI_URL` a `https://wallet.zdevutils.com` i redesplegar.
6. **Opcional**: desplegar el stack d'eines per emetre credencials i publicar un actiu de prova que n'exigeixi una.
7. Un cop funcioni a Portainer, **aturar els serveis walt.id** engegats al servidor del node.

## 7. Recomanacions de seguretat

- **Rotar la clau d'Alchemy**: és a l'historial de git (`variables.txt`).
- **Canviar la contrasenya de l'usuari `dumbnode`** del servidor del node (és molt feble i ha aparegut en una conversa) i, ja que ara hi ha accés per clau, desactivar l'accés SSH amb contrasenya.
- Mantenir el port del servidor de polítiques (8001) i les eines d'emissió només a la LAN.
- Restringir el pont v4 (port 8092) a la LAN fins que tingui accés públic amb TLS.
- A mitjà termini, **actualitzar el node a la v4.2.1** per alinear-lo amb el marketplace v1.5.2.
