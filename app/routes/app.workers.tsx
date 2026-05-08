import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { hashPin, validPin } from "../services/auth.server";
import { ensureShopSettings } from "../services/shop-settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const [workers, locations] = await Promise.all([
    prisma.worker.findMany({
      where: { shopId: shop.id },
      include: { location: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.location.findMany({ where: { shopId: shop.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  return { workers, locations };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "createLocation") {
    const name = String(formData.get("locationName") || "").trim();
    if (!name) return { error: "Inserisci il nome della sede." };
    await prisma.location.create({ data: { shopId: shop.id, name } });
    return { success: "Sede aggiunta." };
  }

  if (intent === "deactivateWorker") {
    const id = String(formData.get("workerId") || "");
    await prisma.worker.update({ where: { id }, data: { active: false } });
    return { success: "Lavoratore disattivato senza cancellare lo storico." };
  }

  if (intent === "deactivateLocation") {
    const id = String(formData.get("locationId") || "");
    await prisma.$transaction([
      prisma.worker.updateMany({ where: { locationId: id }, data: { locationId: null } }),
      prisma.location.update({ where: { id }, data: { active: false } }),
    ]);
    return { success: "Sede disattivata. I lavoratori collegati sono stati spostati su nessuna sede." };
  }

  const pin = String(formData.get("pin") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!name) return { error: "Inserisci il nome del lavoratore." };
  if (!validPin(pin)) return { error: "Il PIN deve avere 4 cifre." };

  const existingPin = await prisma.worker.findFirst({
    where: { shopId: shop.id, pinHash: hashPin(pin), active: true },
  });
  if (existingPin) return { error: "Questo PIN e gia assegnato a un lavoratore attivo." };

  await prisma.worker.create({
    data: {
      shopId: shop.id,
      locationId: String(formData.get("locationId") || "") || null,
      name,
      role: String(formData.get("role") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      photoUrl: String(formData.get("photoUrl") || "").trim() || null,
      pinHash: hashPin(pin),
    },
  });

  return { success: "Lavoratore creato." };
};

export default function WorkersPage() {
  const { workers, locations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Lavoratori">
      {actionData?.error ? <s-banner tone="critical">{actionData.error}</s-banner> : null}
      {actionData?.success ? <s-banner tone="success">{actionData.success}</s-banner> : null}

      <s-section heading="Nuovo lavoratore">
        <Form method="post" className="tc-form-grid">
          <input type="hidden" name="intent" value="createWorker" />
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Ruolo
            <input name="role" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
          <label>
            Sede
            <select name="locationId">
              <option value="">Nessuna sede</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            URL foto
            <input name="photoUrl" placeholder="https://..." />
          </label>
          <label>
            PIN 4 cifre
            <input name="pin" inputMode="numeric" minLength={4} maxLength={4} required />
          </label>
          <button type="submit">Aggiungi lavoratore</button>
        </Form>
      </s-section>

      <s-section heading="Sedi">
        <Form method="post" className="tc-inline-form">
          <input type="hidden" name="intent" value="createLocation" />
          <input name="locationName" placeholder="Nuova sede" />
          <button type="submit">Aggiungi sede</button>
        </Form>
        <div className="tc-location-list">
          {locations.map((location) => (
            <div key={location.id}>
              <span>{location.name}</span>
              <Form method="post">
                <input type="hidden" name="intent" value="deactivateLocation" />
                <input type="hidden" name="locationId" value={location.id} />
                <button type="submit">Disattiva</button>
              </Form>
            </div>
          ))}
        </div>
      </s-section>

      <s-section heading="Elenco lavoratori">
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Ruolo</th>
                <th>Email</th>
                <th>Sede</th>
                <th>Stato</th>
                <th>Azione</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td>
                    <div className="tc-worker-cell">
                      {worker.photoUrl ? <img src={worker.photoUrl} alt="" /> : <span />}
                      {worker.name}
                    </div>
                  </td>
                  <td>{worker.role || "-"}</td>
                  <td>{worker.email || "-"}</td>
                  <td>{worker.location?.name || "-"}</td>
                  <td>{worker.active ? "Attivo" : "Disattivato"}</td>
                  <td>
                    {worker.active ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="deactivateWorker" />
                        <input type="hidden" name="workerId" value={worker.id} />
                        <button type="submit">Disattiva</button>
                      </Form>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </s-section>
    </s-page>
  );
}
