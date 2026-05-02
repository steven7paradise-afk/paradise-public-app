import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import "../styles/paradise-design.css";

const campaignType = "paradise_adv_campaign";

type Campaign = {
  handle: string;
  fields: Record<string, string>;
};

type GraphQLUserError = {
  field?: string[];
  message: string;
};

type MetaobjectNode = {
  id?: string;
  handle: string;
  fields: Array<{ key: string; value: string | null }>;
};

const fieldDefinitions = [
  { key: "desktop_image_url", name: "Desktop image URL", type: "single_line_text_field" },
  { key: "mobile_image_url", name: "Mobile image URL", type: "single_line_text_field" },
  { key: "kicker", name: "Kicker", type: "single_line_text_field" },
  { key: "title", name: "Title", type: "single_line_text_field" },
  { key: "text", name: "Text", type: "multi_line_text_field" },
  { key: "button_label", name: "Button label", type: "single_line_text_field" },
  { key: "button_link_url", name: "Button link URL", type: "url" },
];

function normalizeHandle(value: FormDataEntryValue | null) {
  const raw = String(value || "collection-adv-1").trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection-adv-1";
}

function fieldMap(fields: Array<{ key: string; value: string | null }>) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = field.value || "";
    return acc;
  }, {});
}

async function runGraphql<TData extends Record<string, unknown>>(
  admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"],
  query: string,
  variables = {},
) {
  const response = await admin.graphql(query, { variables });
  const payload: {
    data?: TData;
    errors?: Array<{ message: string }>;
  } = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error: { message: string }) => error.message).join(" "));
  }

  return payload.data as TData;
}

async function ensureCampaignDefinition(admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"]) {
  const existing = await runGraphql<{
    metaobjectDefinitionByType?: { id: string } | null;
  }>(
    admin,
    `#graphql
      query CampaignDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
        }
      }
    `,
    { type: campaignType },
  );

  if (existing.metaobjectDefinitionByType?.id) return;

  const created = await runGraphql<{
    metaobjectDefinitionCreate: {
      metaobjectDefinition?: { id: string } | null;
      userErrors: GraphQLUserError[];
    };
  }>(
    admin,
    `#graphql
      mutation CreateCampaignDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      definition: {
        name: "Paradise ADV Campaign",
        type: campaignType,
        access: { storefront: "PUBLIC_READ" },
        fieldDefinitions,
      },
    },
  );

  const errors = created.metaobjectDefinitionCreate.userErrors as GraphQLUserError[];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(" "));
  }
}

async function getCampaign(admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"], handle: string) {
  const data = await runGraphql<{
    metaobjectByHandle?: MetaobjectNode | null;
  }>(
    admin,
    `#graphql
      query GetCampaign($type: String!, $handle: String!) {
        metaobjectByHandle(handle: { type: $type, handle: $handle }) {
          id
          handle
          fields {
            key
            value
          }
        }
      }
    `,
    { type: campaignType, handle },
  );

  return data.metaobjectByHandle;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  let campaigns: Campaign[] = [];
  let setupError = "";

  try {
    await ensureCampaignDefinition(admin);

    const data = await runGraphql<{
      metaobjects: {
        nodes: MetaobjectNode[];
      };
    }>(
      admin,
      `#graphql
        query Campaigns($type: String!) {
          metaobjects(type: $type, first: 20) {
            nodes {
              handle
              fields {
                key
                value
              }
            }
          }
        }
      `,
      { type: campaignType },
    );

    campaigns = data.metaobjects.nodes.map((campaign) => ({
      handle: campaign.handle,
      fields: fieldMap(campaign.fields),
    }));
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Errore durante il setup delle campagne.";
  }

  return { campaigns, setupError };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const handle = normalizeHandle(formData.get("handle"));

  try {
    await ensureCampaignDefinition(admin);

    const fields = fieldDefinitions.map((field) => ({
      key: field.key,
      value: String(formData.get(field.key) || "").trim(),
    }));

    const existing = await getCampaign(admin, handle);

    if (existing?.id) {
      const updated = await runGraphql<{
        metaobjectUpdate: {
          metaobject?: { id: string; handle: string } | null;
          userErrors: GraphQLUserError[];
        };
      }>(
        admin,
        `#graphql
          mutation UpdateCampaign($id: ID!, $metaobject: MetaobjectUpdateInput!) {
            metaobjectUpdate(id: $id, metaobject: $metaobject) {
              metaobject {
                id
                handle
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        { id: existing.id, metaobject: { fields } },
      );

      const errors = updated.metaobjectUpdate.userErrors as GraphQLUserError[];
      if (errors.length) throw new Error(errors.map((error) => error.message).join(" "));
    } else {
      const created = await runGraphql<{
        metaobjectCreate: {
          metaobject?: { id: string; handle: string } | null;
          userErrors: GraphQLUserError[];
        };
      }>(
        admin,
        `#graphql
          mutation CreateCampaign($metaobject: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $metaobject) {
              metaobject {
                id
                handle
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        { metaobject: { type: campaignType, handle, fields } },
      );

      const errors = created.metaobjectCreate.userErrors as GraphQLUserError[];
      if (errors.length) throw new Error(errors.map((error) => error.message).join(" "));
    }

    return { ok: true, message: `Campagna ${handle} salvata. Tutti gli slot con questo codice si aggiorneranno.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Non sono riuscito a salvare la campagna.",
    };
  }
};

export default function CampaignsPage() {
  const { campaigns, setupError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const firstCampaign = campaigns[0];

  return (
    <main className="pd-home pd-campaigns" aria-label="Paradise ADV Campaign Manager">
      <section className="pd-home-hero">
        <div>
          <span className="pd-home-kicker">Global ADV Campaigns</span>
          <h1>Modifica una campagna, aggiorna tutti gli slot.</h1>
          <p>
            Usa lo stesso codice, per esempio <strong>collection-adv-1</strong>,
            in tutti i blocchi Paradise ADV Slot. Quando salvi qui, ogni blocco
            con quel codice prende la nuova immagine e i nuovi testi.
          </p>
        </div>
        <div className="pd-home-checklist">
          <h2>Come funziona</h2>
          <ol>
            <li>Crea o modifica la campagna qui sotto.</li>
            <li>Nel Theme Editor aggiungi Paradise ADV Slot.</li>
            <li>Scrivi lo stesso codice slot.</li>
            <li>Lascia attivo “Usa campagna globale dall&apos;app”.</li>
            <li>Salva: tutti gli slot uguali si aggiornano insieme.</li>
          </ol>
        </div>
      </section>

      <section className="pd-home-panel">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Campaign Manager</span>
          <h2>Campagna globale</h2>
          <p>
            Per ora inserisci URL immagini gia&apos; online, per esempio immagini
            caricate in Shopify Files/CDN. Il caricamento file diretto dentro
            l&apos;app lo possiamo aggiungere come step successivo.
          </p>
        </div>

        {setupError ? <p className="pd-message pd-message--error">{setupError}</p> : null}
        {actionData?.message ? (
          <p className={`pd-message ${actionData.ok ? "pd-message--success" : "pd-message--error"}`}>
            {actionData.message}
          </p>
        ) : null}

        <Form method="post" className="pd-campaign-form">
          <label>
            Codice slot
            <input name="handle" defaultValue={firstCampaign?.handle || "collection-adv-1"} placeholder="collection-adv-1" />
          </label>
          <label>
            Immagine desktop URL
            <input name="desktop_image_url" defaultValue={firstCampaign?.fields.desktop_image_url || ""} placeholder="https://cdn.shopify.com/..." />
          </label>
          <label>
            Immagine mobile URL
            <input name="mobile_image_url" defaultValue={firstCampaign?.fields.mobile_image_url || ""} placeholder="https://cdn.shopify.com/..." />
          </label>
          <label>
            Sopratitolo
            <input name="kicker" defaultValue={firstCampaign?.fields.kicker || "New edit"} />
          </label>
          <label>
            Titolo
            <input name="title" defaultValue={firstCampaign?.fields.title || "Spring flush."} />
          </label>
          <label>
            Descrizione
            <textarea name="text" defaultValue={firstCampaign?.fields.text || "Campagna editoriale per collezioni, landing e pagine prodotto."} rows={4} />
          </label>
          <label>
            Testo bottone
            <input name="button_label" defaultValue={firstCampaign?.fields.button_label || "Shop now"} />
          </label>
          <label>
            Link bottone
            <input name="button_link_url" defaultValue={firstCampaign?.fields.button_link_url || ""} placeholder="https://..." />
          </label>
          <button className="pd-home-button" type="submit">Salva campagna globale</button>
        </Form>
      </section>

      <section className="pd-home-panel">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Campagne salvate</span>
          <h2>Codici disponibili</h2>
        </div>
        <div className="pd-home-adv-grid">
          {campaigns.length ? campaigns.map((campaign) => (
            <article className="pd-home-adv-card" key={campaign.handle}>
              <span>Globale</span>
              <h3>{campaign.handle}</h3>
              <p>{campaign.fields.title || "Campagna senza titolo"}</p>
              <strong>Usa questo codice</strong>
            </article>
          )) : (
            <article className="pd-home-adv-card">
              <span>Vuoto</span>
              <h3>collection-adv-1</h3>
              <p>Salva la prima campagna per creare il codice globale.</p>
              <strong>Pronto</strong>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
