#!/usr/bin/env bash
# Apply the Empower-X ocean-node patches to an ocean-node source checkout,
# then (optionally) rebuild the image and recreate the node.
#
#   sudo bash apply-patches.sh /home/dumbnode/soft/ocean/oe-node            # patch source only
#   sudo bash apply-patches.sh /home/dumbnode/soft/ocean/oe-node --deploy   # patch + build + recreate
#
# Safe to run repeatedly: patches already in place are skipped. Changed files get a
# .bak-empowerx copy (ignored by the node's .dockerignore). If the build fails, the
# running node is left untouched.
set -euo pipefail

NODE_DIR="${1:?usage: apply-patches.sh <ocean-node source dir> [--deploy]}"
DEPLOY="${2:-}"
PATCH_DIR="$(cd "$(dirname "$0")/patches" && pwd)"

cd "$NODE_DIR"
[ -f src/components/core/handler/downloadHandler.ts ] || { echo "Not an ocean-node source dir: $NODE_DIR" >&2; exit 1; }
grep -q '"version": "3.2.1"' package.json || echo "WARNING: patches were written for ocean-node 3.2.1; this is $(grep -m1 '"version"' package.json)"

failed=0
for p in "$PATCH_DIR"/*.patch; do
  name="$(basename "$p")"
  if patch -p1 -R --dry-run -s -f < "$p" >/dev/null 2>&1; then
    echo "  already applied  $name"
  elif patch -p1 --dry-run -s -f < "$p" >/dev/null 2>&1; then
    patch -p1 -s -f -b -z .bak-empowerx < "$p"
    echo "  applied          $name"
  else
    echo "  DOES NOT APPLY   $name  (source changed upstream - re-port this patch by hand)" >&2
    failed=1
  fi
done
[ "$failed" = 0 ] || { echo "Some patches did not apply; nothing was built." >&2; exit 1; }

# The image is built locally and exists in no registry, so never try to pull it.
if grep -q 'pull_policy: always' docker-compose.yml; then
  cp docker-compose.yml docker-compose.yml.bak-empowerx
  sed -i 's/pull_policy: always/pull_policy: missing/' docker-compose.yml
  echo "  docker-compose.yml: pull_policy always -> missing"
fi

[ "$DEPLOY" = "--deploy" ] || { echo "Source patched. Re-run with --deploy to build and recreate the node."; exit 0; }

echo "Building oe-node image from patched source..."
docker compose build oe-node
echo "Recreating oe-node..."
docker compose up -d oe-node

echo "Waiting for the node to become healthy..."
for _ in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' oe-node 2>/dev/null || true)"
  [ "$status" = healthy ] && break
  sleep 5
done
echo "  health: ${status:-unknown}"

echo "Patches in the running node's compiled code:"
D=/usr/src/app/dist
check() { if docker exec oe-node grep -q "$2" "$D/$1"; then echo "  ok       $3"; else echo "  MISSING  $3"; fi; }
check components/storage/UrlStorage.js        'timeout: 120000'        '01 download source timeout 120s'
check components/c2d/compute_engine_docker.js 'tagColon'               '02 C2D image tag@digest'
check components/core/handler/downloadHandler.js "key.toLowerCase() === 'content-length'" '03 no Content-Length on downloads'
check utils/util.js                           'address: log.address'   '04a event emitter address'
check components/core/utils/validateOrders.js 'isFromDatatoken'        '04b order validated by emitter'
check utils/asset.js                          'FILE_METADATA_TIMEOUT_MS' '05 file metadata timeout'
echo "In-container edits (expect none under dist):"
docker diff oe-node | grep '/usr/src/app/dist/' | sed 's/^/  /' || echo "  none"
