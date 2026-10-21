# OE dev wallet with the key-page fixes from patch.mjs (no private key in
# "Public JWK", kid shown in the JWK, delete reports errors).
ARG BASE=oceanenterprise/waltid-dev-wallet:gaiax-0.1.5-OE
FROM ${BASE}
COPY patch.mjs /tmp/patch.mjs
RUN node /tmp/patch.mjs && rm /tmp/patch.mjs
