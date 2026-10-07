#!/bin/sh
# Renders /templates/* into /out/<service> volumes. Only the variables listed in
# VARS are substituted, so HOCON's own ${...} references are left intact.
set -eu

: "${WALLET_HOST:?WALLET_HOST is required}"
: "${MARKET_ORIGINS:?MARKET_ORIGINS is required (space/comma separated)}"
: "${WALLET_ENCRYPTION_KEY:?run generate-secrets first}"
: "${WALLET_SIGN_KEY:?run generate-secrets first}"
: "${WALLET_TOKEN_KEY:?run generate-secrets first}"
: "${WALLET_AUTHNZ_JWK:?run generate-secrets first}"
: "${WALLET_PEPPER:?run generate-secrets first}"

# "https://a.example https://b.example" -> https://a\.example|https://b\.example
MARKET_ORIGINS_REGEX=$(echo "$MARKET_ORIGINS" | tr ', ' '\n\n' | sed '/^$/d; s/\./\\./g' | paste -sd '|' -)
export MARKET_ORIGINS_REGEX

VARS='${WALLET_HOST} ${MARKET_ORIGINS_REGEX} ${WALLET_ENCRYPTION_KEY} ${WALLET_SIGN_KEY} ${WALLET_TOKEN_KEY} ${WALLET_AUTHNZ_JWK} ${WALLET_PEPPER}'

render_dir() {
  src="$1"; dst="$2"
  [ -d "$dst" ] || return 0
  for f in "$src"/*; do
    envsubst "$VARS" < "$f" > "$dst/$(basename "$f")"
  done
  echo "rendered $src -> $dst"
}

render_dir /templates/wallet-api /out/wallet-api
render_dir /templates/verifier-api /out/verifier-api
render_dir /templates/issuer-api /out/issuer-api

if [ -d /out/caddy ]; then
  envsubst "$VARS" < /templates/Caddyfile > /out/caddy/Caddyfile
  echo "rendered Caddyfile"
fi

# Self-signed TLS for OPA (only called by the verifier on the internal network).
if [ -d /out/opa-certs ] && [ ! -s /out/opa-certs/tls.pem ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=opa-server" \
    -addext "subjectAltName=DNS:opa-server,DNS:localhost" \
    -keyout /out/opa-certs/tls.key -out /out/opa-certs/tls.pem 2>/dev/null
  chmod 644 /out/opa-certs/tls.key /out/opa-certs/tls.pem
  echo "generated OPA certificate"
fi
