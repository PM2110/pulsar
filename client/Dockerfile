FROM node:22-alpine

WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package management files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy application files
COPY . .

# Expose Next.js port
EXPOSE 3000

# Start development server
CMD ["pnpm", "dev"]
