# ─────────────────────────────────────────────
# Stage 1: builder — install dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

# ─────────────────────────────────────────────
# Stage 2: production image
# ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY app.js package.json ./

RUN chown -R appuser:appgroup /app

USER appuser

# Accept build-time version arg and bake it into the image
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production

EXPOSE 8080

# Docker-native health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health/check', r => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "app.js"]
