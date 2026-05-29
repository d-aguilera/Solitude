FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY scripts ./scripts
COPY vite*.config.ts ./
COPY tsconfig*.json ./

RUN npm ci
RUN npm run build:client && npm run build:server

FROM node:22-slim AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV WS_NO_BUFFER_UTIL=true
ENV WS_NO_UTF_8_VALIDATE=true

EXPOSE 8080

CMD ["npm", "run", "start:server"]
