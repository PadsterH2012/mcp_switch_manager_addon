# Multi-stage build for MCP Switch Manager Addon
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for network tools
RUN apk add --no-cache \
    curl \
    iputils \
    net-tools \
    tcpdump \
    nmap \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=mcp:nodejs /app .

# Create necessary directories
RUN mkdir -p logs config/backups data && \
    chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8087/health || exit 1

# Environment variables
ENV NODE_ENV=production \
    MCP_PORT=8087 \
    LOG_LEVEL=info \
    MCP_ADDON_NAME=switch-manager

# Start the application
CMD ["node", "src/server.js"]
