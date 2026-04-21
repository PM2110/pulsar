# Stage 1: Base & Dependencies
FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./

# Stage 2: Development (Includes devDependencies)
FROM base AS development
RUN pnpm install --frozen-lockfile
COPY . .
# We'll use volumes and 'pnpm dev' from docker-compose

# Stage 3: Builder
FROM development AS builder
RUN pnpm build

# Stage 4: Production (Only production dependencies)
FROM base AS production
ENV NODE_ENV=production
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
