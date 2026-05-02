FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/production.sqlite

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm cache clean --force

CMD ["sh", "-c", "mkdir -p /data && npm run docker-start"]
