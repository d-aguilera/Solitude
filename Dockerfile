FROM node:22-slim AS builder

WORKDIR /app

COPY . .

RUN npm ci && npm run build:client && npm run build:server

FROM node:22-slim AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV WS_NO_BUFFER_UTIL=true
ENV WS_NO_UTF_8_VALIDATE=true

EXPOSE 8080

CMD ["node", "dist/server/main.js"]
