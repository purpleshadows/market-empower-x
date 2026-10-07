# Tiny one-shot image that renders the walt.id config templates in this folder
# with per-deployment values (hosts, secrets) and writes them into the named
# volumes the SSI services mount. Lets the stack run from Portainer (Git
# repository mode) without any files on the host.
FROM alpine:3.20
RUN apk add --no-cache gettext openssl
COPY wallet-api /templates/wallet-api
COPY verifier-api /templates/verifier-api
COPY issuer-api /templates/issuer-api
COPY Caddyfile /templates/Caddyfile
COPY render.sh /render.sh
RUN chmod +x /render.sh
ENTRYPOINT ["/render.sh"]
