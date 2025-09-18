# -----------------------
# Base image
# -----------------------
FROM node:20-alpine AS base

WORKDIR /app

# -----------------------
# Dependencies stage
# -----------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# -----------------------
# Build stage
# -----------------------
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm ci
RUN npm run build

# -----------------------
# Production runner
# -----------------------
FROM base AS runner

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_URL="file:/app/data/db.sqlite"

# Copy build artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# Copy scripts and shared directories
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/shared ./shared

# Create uploads directory structure
RUN mkdir -p /app/uploads/materials /app/uploads/thumbnails

# Copy a pre-seeded database (you need to create this locally with schema + data)
COPY db.sqlite /app/init/db.sqlite
RUN chown -R nextjs:nodejs /app/init

# Create required directories and set ownership
RUN mkdir -p /app/data \
    && chown -R nextjs:nodejs /app/data /app/uploads

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

ENTRYPOINT ["/docker-entrypoint.sh"]
