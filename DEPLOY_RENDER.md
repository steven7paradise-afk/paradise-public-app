# Paradise Design - Deploy Admin App

Questa app ha due parti:

- Theme App Extension: pubblicata con `shopify app deploy`.
- Dashboard admin Shopify: deve stare online su hosting vero.

Se la dashboard mostra `Example Domain`, significa che `application_url` punta ancora a `https://example.com`.

## 1. Crea il servizio su Render

1. Vai su Render.
2. Crea un nuovo `Blueprint` oppure `Web Service` collegando questa repo.
3. Usa il file `render.yaml`.
4. Inserisci queste variabili ambiente:

```txt
SHOPIFY_API_KEY=client id della app
SHOPIFY_API_SECRET=client secret della app
SHOPIFY_APP_URL=https://URL-RENDER.onrender.com
SCOPES=write_metaobject_definitions,write_metaobjects,write_products
DATABASE_URL=file:/data/production.sqlite
```

Il disco persistente `/data` mantiene le sessioni Shopify.

## 2. Aggiorna Shopify app config

Quando Render ti dà l'URL finale, aggiorna `shopify.app.paradise-design.toml`:

```toml
application_url = "https://URL-RENDER.onrender.com"

[auth]
redirect_urls = [ "https://URL-RENDER.onrender.com/auth/callback" ]
```

Poi pubblica la config:

```bash
shopify app deploy --config shopify.app.paradise-design.toml --allow-updates --message "Set production app URL"
```

## 3. Reinstalla/apri l'app nello store

Dopo il deploy, apri l'app da Shopify Admin. La dashboard non deve piu' aprire `Example Domain`.
