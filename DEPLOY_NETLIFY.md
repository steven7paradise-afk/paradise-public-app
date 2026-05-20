# Deploy Netlify - Paradise Design

Questa app Shopify e' una app React Router con backend OAuth, quindi su Netlify deve girare come Function SSR, non come sito statico.

## 1. Database

Netlify non mantiene un file SQLite persistente come Render. Usa un PostgreSQL esterno:

- Neon
- Supabase
- Netlify DB/Postgres, se disponibile nel tuo account

Prendi la connection string e mettila in Netlify come:

```txt
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

## 2. Variabili Netlify

In Netlify > Site configuration > Environment variables aggiungi:

```txt
SHOPIFY_API_KEY=42dc399cfbfed4bef0844ac123237b6b
SHOPIFY_API_SECRET=IL_TUO_SECRET_SHOPIFY
SHOPIFY_APP_URL=https://TUO-SITO-NETLIFY.netlify.app
SCOPES=write_metaobject_definitions,write_metaobjects,write_products,write_files
DATABASE_URL=postgresql://...
```

## 3. Build Netlify

Il file `netlify.toml` e' gia' pronto:

```txt
Build command: npm run netlify:build
Publish directory: build/client
```

Durante il build viene eseguito:

```txt
prisma generate
prisma db push --skip-generate
react-router build
```

Questo crea/aggiorna le tabelle nel database PostgreSQL.

## 4. Shopify URL

Dopo il primo deploy Netlify, copia `shopify.app.netlify.example.toml`:

```sh
cp shopify.app.netlify.example.toml shopify.app.netlify.toml
```

Poi sostituisci `https://YOUR-NETLIFY-SITE.netlify.app` con l'URL reale Netlify.

Infine aggiorna Shopify:

```sh
shopify app deploy --config shopify.app.netlify.toml
```

## 5. App installata

Dopo il deploy, apri l'app nello store Shopify. Se chiede login o resta bianca, controlla:

- `SHOPIFY_APP_URL` uguale all'URL Netlify
- redirect URL Shopify uguale a `https://TUO-SITO-NETLIFY.netlify.app/auth/callback`
- `DATABASE_URL` valido
- `SHOPIFY_API_SECRET` corretto

Non impostare `NODE_ENV=production` manualmente su Netlify: durante l'installazione puo' impedire l'installazione delle devDependencies necessarie al build.

## Nota importante

Il theme app extension continua a essere pubblicato con Shopify CLI. Netlify serve solo la dashboard/backend dell'app.
