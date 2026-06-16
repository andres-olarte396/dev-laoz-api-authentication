# Build context: core/
FROM node:18-alpine AS builder
WORKDIR /workspace

COPY dev-laoz-config-loader/package.json dev-laoz-config-loader/
COPY dev-laoz-config-loader/index.js dev-laoz-config-loader/
COPY dev-laoz-config-loader/src/ dev-laoz-config-loader/src/

COPY dev-laoz-authentication-api/package*.json app/
WORKDIR /workspace/app
RUN npm install --omit=dev --install-links

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache wget

COPY --from=builder /workspace/app/node_modules ./node_modules
COPY dev-laoz-authentication-api/src ./src
COPY dev-laoz-authentication-api/package.json .

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
