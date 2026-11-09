FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini && mkdir -p /data/files && chown node:node /data/files
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY config ./config
COPY views ./views
COPY src ./src
COPY scripts/sync-model.js scripts/run-job.js scripts/queue-status.js scripts/import-mirrors.js scripts/enqueue-actions.js ./scripts/
USER node
EXPOSE 4001
VOLUME ["/data/files"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT:-4001}/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/main.js"]
