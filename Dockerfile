FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js .
COPY --from=builder /app/admin.js .
COPY --from=builder /app/index.js .

# Create directories
RUN mkdir -p music_cache public/downloads users.json

# Ensure worker directory exists
RUN mkdir -p public/downloads

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/worker-status || exit 1

CMD ["npm", "start"]
