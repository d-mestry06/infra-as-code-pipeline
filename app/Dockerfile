FROM node:20-alpine

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY app.js package.json ./

RUN chown -R appuser:appgroup /app

USER appuser

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health/check', r => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

CMD ["node", "app.js"]
