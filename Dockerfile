FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY scripts ./scripts
COPY vite*.config.ts ./
COPY tsconfig*.json ./

RUN npm ci
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DIST_DIR=dist/client

EXPOSE 8080

CMD ["npm", "run", "start:server"]
