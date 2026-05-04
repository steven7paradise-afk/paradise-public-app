import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";
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
  fields: Array<{
    key: string;
    value: string | null;
    reference?: {
      image?: {
        url?: string | null;
      } | null;
    } | null;
  }>;
};

const fieldDefinitions = [
  { key: "is_active", name: "Attiva", type: "boolean" },
  { key: "starts_at", name: "Data inizio", type: "date_time" },
  { key: "ends_at", name: "Data fine", type: "date_time" },
  { key: "desktop_image", name: "Immagine desktop", type: "file_reference" },
  { key: "mobile_image", name: "Immagine mobile", type: "file_reference" },
  { key: "kicker", name: "Sopratitolo", type: "single_line_text_field" },
  { key: "title", name: "Titolo", type: "single_line_text_field" },
  { key: "text", name: "Descrizione", type: "multi_line_text_field" },
  { key: "button_label", name: "Testo bottone", type: "single_line_text_field" },
  { key: "button_link_url", name: "Link bottone", type: "url" },
  { key: "text_position", name: "Posizione testo", type: "single_line_text_field" },
];

const legacyFieldKeys = ["desktop_image_url", "mobile_image_url"];

function normalizeHandle(value: FormDataEntryValue | null) {
  const raw = String(value || "collection-adv-1").trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "collection-adv-1";
}

function fieldMap(fields: MetaobjectNode["fields"]) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = field.value || "";
    if (field.reference?.image?.url) {
      acc[`${field.key}_preview_url`] = field.reference.image.url;
    }
    return acc;
  }, {});
}

function campaignStatus(fields: Record<string, string>) {
  const now = Date.now();
  const isActive = fields.is_active !== "false";
  const startsAt = fields.starts_at ? Date.parse(fields.starts_at) : null;
  const endsAt = fields.ends_at ? Date.parse(fields.ends_at) : null;

  if (!isActive) return { label: "Disattivata", tone: "off" };
  if (startsAt && now < startsAt) return { label: "Programmata", tone: "scheduled" };
  if (endsAt && now > endsAt) return { label: "Scaduta", tone: "off" };
  return { label: "Attiva", tone: "active" };
}

function textPositionTone(value = "") {
  const normalized = value.trim().toLowerCase();

  if (["destra", "right", "basso destra", "bottom-right", "bottom right"].includes(normalized)) return "right";
  if (["centro", "center", "basso centro", "bottom-center", "bottom center"].includes(normalized)) return "center";
  if (["alto destra", "top-right", "top right"].includes(normalized)) return "top-right";
  if (["alto centro", "top-center", "top center"].includes(normalized)) return "top-center";
  if (["alto sinistra", "top-left", "top left"].includes(normalized)) return "top-left";
  if (["nascosto", "hidden", "solo immagine"].includes(normalized)) return "hidden";

  return "left";
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
    metaobjectDefinitionByType?: {
      id: string;
      fieldDefinitions: Array<{ key: string }>;
    } | null;
  }>(
    admin,
    `#graphql
      query CampaignDefinition($type: String!) {
        metaobjectDefinitionByType(type: $type) {
          id
          fieldDefinitions {
            key
          }
        }
      }
    `,
    { type: campaignType },
  );

  if (existing.metaobjectDefinitionByType?.id) {
    const existingKeys = new Set(existing.metaobjectDefinitionByType.fieldDefinitions.map((field) => field.key));
    const missingFields = fieldDefinitions.filter((field) => !existingKeys.has(field.key));
    const legacyFields = legacyFieldKeys.filter((key) => existingKeys.has(key));

    if (!missingFields.length && !legacyFields.length) return;

    const updated = await runGraphql<{
      metaobjectDefinitionUpdate: {
        metaobjectDefinition?: { id: string } | null;
        userErrors: GraphQLUserError[];
      };
    }>(
      admin,
      `#graphql
        mutation UpdateCampaignDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
          metaobjectDefinitionUpdate(id: $id, definition: $definition) {
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
        id: existing.metaobjectDefinitionByType.id,
        definition: {
          fieldDefinitions: [
            ...missingFields.map((field) => ({
              create: field,
            })),
            ...legacyFields.map((key) => ({
              delete: { key },
            })),
          ],
        },
      },
    );

    const errors = updated.metaobjectDefinitionUpdate.userErrors as GraphQLUserError[];
    if (errors.length) {
      throw new Error(errors.map((error) => error.message).join(" "));
    }

    return;
  }

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
            reference {
              ... on MediaImage {
                image {
                  url
                }
              }
            }
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
  const selectedHandle = new URL(request.url).searchParams.get("handle") || "";

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
                reference {
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
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

  return { campaigns, selectedHandle, setupError };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const handle = normalizeHandle(formData.get("handle"));

  try {
    await ensureCampaignDefinition(admin);

    const appFormFieldKeys = ["kicker", "title", "text", "button_label", "button_link_url", "text_position"];
    const editableFieldDefinitions = fieldDefinitions.filter((field) => appFormFieldKeys.includes(field.key));
    const fields = editableFieldDefinitions.map((field) => ({
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
  const { campaigns, selectedHandle, setupError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const firstCampaign = campaigns[0];
  const selectedCampaign = campaigns.find((campaign) => campaign.handle === selectedHandle) || firstCampaign;
  const selectedPreviewImage =
    selectedCampaign?.fields.desktop_image_preview_url ||
    selectedCampaign?.fields.mobile_image_preview_url ||
    "";
  const selectedMobilePreviewImage =
    selectedCampaign?.fields.mobile_image_preview_url ||
    selectedCampaign?.fields.desktop_image_preview_url ||
    "";
  const selectedPreviewStyle = (image: string) =>
    image
      ? {
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22)), url("${image}")`,
        }
      : undefined;

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
            Per le collezioni puoi anche usare il codice automatico{" "}
            <strong>collection-handle-collezione</strong>.
          </p>
        </div>
        <div className="pd-home-checklist">
          <h2>Come funziona</h2>
          <ol>
            <li>Crea o modifica la campagna qui sotto.</li>
            <li>Nel Theme Editor aggiungi Paradise ADV Slot.</li>
            <li>Scrivi lo stesso codice slot.</li>
            <li>Per una collezione attiva “Usa campagna della collezione corrente”.</li>
            <li>Lascia attivo “Usa campagna globale dall&apos;app”.</li>
            <li>Salva: tutti gli slot uguali si aggiornano insieme.</li>
          </ol>
        </div>
      </section>

      <section className="pd-home-panel" id="campaign-form">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Campaign Manager</span>
          <h2>{selectedCampaign ? `Modifica ${selectedCampaign.handle}` : "Campagna globale"}</h2>
          <p>
            Puoi selezionare le immagini direttamente da Shopify Metaobjects
            usando i campi Desktop image e Mobile image. Usa Active, Start date
            ed End date per attivare, disattivare o programmare la campagna.
            Per una pagina collezione crea un handle tipo{" "}
            <strong>collection-extension-clip-paradise</strong>.
          </p>
        </div>

        {setupError ? <p className="pd-message pd-message--error">{setupError}</p> : null}
        {actionData?.message ? (
          <p className={`pd-message ${actionData.ok ? "pd-message--success" : "pd-message--error"}`}>
            {actionData.message}
          </p>
        ) : null}

        <Form method="post" className="pd-campaign-form" key={selectedCampaign?.handle || "new-campaign"}>
          <label>
            Codice slot
            <input name="handle" defaultValue={selectedCampaign?.handle || "collection-adv-1"} placeholder="collection-adv-1" />
          </label>
          <label>
            Sopratitolo
            <input name="kicker" defaultValue={selectedCampaign?.fields.kicker || ""} placeholder="Es. Promo, New drop, Limited edition" />
          </label>
          <label>
            Titolo
            <input name="title" defaultValue={selectedCampaign?.fields.title || ""} placeholder="Titolo campagna" />
          </label>
          <label>
            Descrizione
            <textarea name="text" defaultValue={selectedCampaign?.fields.text || ""} rows={4} placeholder="Descrizione opzionale" />
          </label>
          <label>
            Testo bottone
            <input name="button_label" defaultValue={selectedCampaign?.fields.button_label || ""} placeholder="Es. Acquista ora" />
          </label>
          <label>
            Link bottone
            <input name="button_link_url" defaultValue={selectedCampaign?.fields.button_link_url || ""} placeholder="https://..." />
          </label>
          <label>
            Posizione testo
            <select name="text_position" defaultValue={selectedCampaign?.fields.text_position || "sinistra"}>
              <option value="sinistra">Sinistra</option>
              <option value="centro">Centro</option>
              <option value="destra">Destra</option>
              <option value="alto sinistra">Alto sinistra</option>
              <option value="alto centro">Alto centro</option>
              <option value="alto destra">Alto destra</option>
              <option value="nascosto">Solo immagine</option>
            </select>
          </label>
          <button className="pd-home-button" type="submit">Salva campagna globale</button>
        </Form>
      </section>

      <section className="pd-home-panel">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Workflow consigliato</span>
          <h2>Un codice, tanti blocchi</h2>
        </div>
        <div className="pd-workflow-grid">
          <article>
            <span>01</span>
            <h3>Crea campagna</h3>
            <p>Da Metaobjects scegli immagini, date, testi e stato attivo.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Scegli sorgente</h3>
            <p>Usa codice manuale oppure attiva la campagna automatica della collezione.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Aggiorna ovunque</h3>
            <p>Ogni blocco con quel codice cambia insieme alla campagna.</p>
          </article>
        </div>
      </section>

      <section className="pd-home-panel">
        <div className="pd-home-panel-head">
          <span className="pd-home-kicker">Campagne salvate</span>
          <h2>Codici disponibili</h2>
        </div>
        <div className="pd-home-adv-grid">
          {campaigns.length ? campaigns.map((campaign) => (
            <article className="pd-home-adv-card" key={campaign.handle}>
              <span className={`pd-status pd-status--${campaignStatus(campaign.fields).tone}`}>
                {campaignStatus(campaign.fields).label}
              </span>
              <h3>{campaign.handle}</h3>
              <p>{campaign.fields.title || "Campagna senza titolo"}</p>
              <Link className="pd-code-link" to={`/app/campaigns?handle=${encodeURIComponent(campaign.handle)}#campaign-form`}>
                Modifica codice
              </Link>
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

      {selectedCampaign ? (
        <section className="pd-home-panel">
          <div className="pd-home-panel-head">
            <span className="pd-home-kicker">Preview</span>
            <h2>Anteprima {selectedCampaign.handle}</h2>
          </div>
          <div className="pd-preview-grid">
            <article>
              <span className="pd-preview-label">Desktop</span>
              <div
                className={`pd-campaign-preview pd-campaign-preview--${textPositionTone(selectedCampaign.fields.text_position)} ${
                  selectedPreviewImage ? "pd-campaign-preview--has-image" : ""
                }`}
                style={selectedPreviewStyle(selectedPreviewImage)}
              >
                {selectedCampaign.fields.kicker ? <span>{selectedCampaign.fields.kicker}</span> : null}
                {selectedCampaign.fields.title ? <h3>{selectedCampaign.fields.title}</h3> : <h3>Solo immagine</h3>}
                {selectedCampaign.fields.text ? <p>{selectedCampaign.fields.text}</p> : <p>Nessuna descrizione impostata.</p>}
                {selectedCampaign.fields.button_label ? <strong>{selectedCampaign.fields.button_label}</strong> : null}
              </div>
            </article>
            <article>
              <span className="pd-preview-label">Mobile</span>
              <div
                className={`pd-campaign-preview pd-campaign-preview--mobile pd-campaign-preview--${textPositionTone(
                  selectedCampaign.fields.text_position,
                )} ${selectedMobilePreviewImage ? "pd-campaign-preview--has-image" : ""}`}
                style={selectedPreviewStyle(selectedMobilePreviewImage)}
              >
                {selectedCampaign.fields.kicker ? <span>{selectedCampaign.fields.kicker}</span> : null}
                {selectedCampaign.fields.title ? <h3>{selectedCampaign.fields.title}</h3> : <h3>Solo immagine</h3>}
                {selectedCampaign.fields.text ? <p>{selectedCampaign.fields.text}</p> : <p>Nessuna descrizione impostata.</p>}
                {selectedCampaign.fields.button_label ? <strong>{selectedCampaign.fields.button_label}</strong> : null}
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
