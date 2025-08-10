# SED - Semantic Entity Designs
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sed -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=sed:nodejs /app/dist ./dist
COPY --from=builder --chown=sed:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sed:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /app/data && chown sed:nodejs /app/data

# Switch to non-root user
USER sed

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/cli.js test || exit 1

# Expose port
EXPOSE 3000

# Default command
CMD ["node", "dist/cli.js"]

# Labels
LABEL maintainer="SED Team"
LABEL description="Semantic Entity Designs - AI-powered database semantic layer"
LABEL version="1.0.0" 