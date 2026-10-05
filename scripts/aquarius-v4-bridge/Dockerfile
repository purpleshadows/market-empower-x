# Zero-dependency service: Node 20 built-in http + global fetch only.
FROM node:20-alpine
WORKDIR /app
COPY transform.mjs bridge.mjs ./
ENV PORT=8080
EXPOSE 8080
# Lightweight healthcheck against the bridge's own /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/bridge/health || exit 1
CMD ["node", "bridge.mjs"]
