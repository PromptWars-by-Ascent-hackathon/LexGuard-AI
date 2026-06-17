# =========================================
#  LexGuard AI — Combined Production Dockerfile
#  Target: Google Cloud Run
# =========================================

# --- Phase 1: Build the React Frontend ---
FROM node:22-alpine AS frontend-build
WORKDIR /frontend

# Copy frontend packages first to utilize caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the rest of frontend and build
COPY frontend/ ./
RUN npm run build

# --- Phase 2: Assemble the Node.js Backend ---
FROM node:22-alpine AS final
WORKDIR /app

# Install backend production dependencies
COPY backend-node/package.json backend-node/package-lock.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy backend source
COPY backend-node/src/ ./src/

# Copy built frontend static files into backend's static folder
COPY --from=frontend-build /frontend/dist/ ./src/static/

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Setup non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "src/index.js"]
