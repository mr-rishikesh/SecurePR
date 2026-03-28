# Worker Dockerfile — runs the BullMQ PR review worker
FROM node:20-alpine

WORKDIR /app

# Install tsx for TypeScript runtime execution
RUN npm install -g tsx

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

CMD ["node", "--import", "tsx/esm", "worker.mjs"]
