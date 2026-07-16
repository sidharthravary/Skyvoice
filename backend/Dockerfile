# Build from the repository root (docker compose sets context: .)
# node:20 (not alpine/slim) ships python3 + build tools that mediasoup needs.
FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend
COPY backend backend
RUN npm run build -w backend

FROM node:20
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend --omit=dev
COPY --from=builder /app/backend/dist ./backend/dist
EXPOSE 3011
CMD ["node", "backend/dist/server.js"]
