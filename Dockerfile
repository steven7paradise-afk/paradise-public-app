FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/production.sqlite
ENV SHOPIFY_API_KEY=42dc399cfbfed4bef0844ac123237b6b
ENV SHOPIFY_APP_URL=https://paradise-public-app.onrender.com
ENV SCOPES=write_metaobject_definitions,write_metaobjects,write_products

COPY package.json package-lock.json* ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm cache clean --force

CMD ["sh", "-c", "mkdir -p /data && npm run docker-start"]
