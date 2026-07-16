# Build from the repository root (docker compose sets context: .)
FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w frontend
COPY frontend frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w frontend

FROM node:20
WORKDIR /app/frontend
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/frontend ./
EXPOSE 3010
CMD ["npx", "next", "start", "-p", "3010", "-H", "0.0.0.0"]
