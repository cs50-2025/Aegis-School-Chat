FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including devDependencies for building frontend)
RUN npm install

# Copy source code
COPY . .

# Build frontend and compile TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package.json ./
RUN npm install --production

# Copy built frontend assets and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
