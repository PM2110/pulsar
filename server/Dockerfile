# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

ENV PNPM_STORE_DIR=/home/node/.pnpm-store

# Install pnpm
RUN npm install -g pnpm@10.33.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine

# Set to production
ENV NODE_ENV=production
ENV PNPM_STORE_DIR=/home/node/.pnpm-store

WORKDIR /app

# Install pnpm for production dependency management
RUN npm install -g pnpm@10.33.0

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
# Alpine node image already has a 'node' user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.js"]
