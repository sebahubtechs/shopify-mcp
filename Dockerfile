# Shopify MCP — container image for remote (HTTP/SSE) deployment on Railway, etc.
# Local/stdio usage does NOT need this; see the README "Local setup" section.

# --- Build stage: compile TypeScript to dist/ ---
FROM node:24-alpine@sha256:1200d815de24f8dcca745fbf7651d166034a35adbcad8860a8538ffff44f1420 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- Runtime stage: production deps + compiled output only ---
FROM node:24-alpine@sha256:1200d815de24f8dcca745fbf7651d166034a35adbcad8860a8538ffff44f1420
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/schema ./schema
USER node

# Railway injects PORT at runtime; the server reads it (defaults to 3000).
EXPOSE 3000

# --remote enables HTTP/SSE mode (equivalent to REMOTE_MCP=true).
CMD ["node", "dist/index.js", "--remote"]
