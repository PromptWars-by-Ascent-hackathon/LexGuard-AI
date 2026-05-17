# =========================================
#  LexGuard AI — Production Dockerfile
#  Target: Google Cloud Run
# =========================================

FROM node:22-alpine AS base
WORKDIR /app

# Install only production dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy source (excludes node_modules via .dockerignore)
COPY src/ ./src/

# Expose the port Cloud Run will route traffic to
EXPOSE 8080

# Cloud Run injects PORT env var — default to 8080
ENV PORT=8080
ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health check — Cloud Run will use /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "src/index.js"]
