import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShopSettings } from "../services/shop-settings.server";
import {
  calculateTotalMinutes,
  currentStatus,
  formatMinutes,
  roundBackwardTo30,
  roundForwardTo30,
  startOfWorkDate,
  statusLabel,
} from "../utils/time-clock";

function toDateTimeInput(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text ? new Date(text) : null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const today = startOfWorkDate();

  const [workers, entries, edits] = await Promise.all([
    prisma.worker.findMany({
      where: { shopId: shop.id, active: true },
      include: {
        location: true,
        timeEntries: {
          where: { workDate: today },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { shopId: shop.id },
      include: { worker: true, location: true },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.timeEntryEdit.findMany({
      where: { timeEntry: { shopId: shop.id } },
      include: { timeEntry: { include: { worker: true } }, adminUser: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const clockUrl =
    process.env.STOREFRONT_CLOCK_URL ||
    (process.env.SHOP_CUSTOM_DOMAIN
      ? `https://${process.env.SHOP_CUSTOM_DOMAIN}/apps/timbratura`
      : "https://www.paradisebeauty.it/apps/timbratura");

  return { shop, workers, entries, edits, clockUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const formData = await request.formData();
  const note = String(formData.get("note") || "").trim();
  const id = String(formData.get("entryId") || "");

  if (!note) return { error: "La nota e obbligatoria per modificare un orario." };

  const entry = await prisma.timeEntry.findFirst({ where: { id, shopId: shop.id } });
  if (!entry) return { error: "Timbratura non trovata." };

  const clockInReal = parseOptionalDate(formData.get("clockInReal"));
  const breakStartReal = parseOptionalDate(formData.get("breakStartReal"));
  const breakEndReal = parseOptionalDate(formData.get("breakEndReal"));
  const clockOutReal = parseOptionalDate(formData.get("clockOutReal"));

  const next = {
    clockInReal,
    clockInRounded: clockInReal ? roundForwardTo30(clockInReal) : null,
    breakStartReal,
    breakStartRounded: breakStartReal ? roundForwardTo30(breakStartReal) : null,
    breakEndReal,
    breakEndRounded: breakEndReal ? roundBackwardTo30(breakEndReal) : null,
    clockOutReal,
    clockOutRounded: clockOutReal ? roundBackwardTo30(clockOutReal) : null,
  };

  const totalMinutes = calculateTotalMinutes({ ...entry, ...next });
  const changedFields = Object.entries(next).filter(([key, value]) => {
    const previous = entry[key as keyof typeof entry] as Date | null;
    return (previous?.toISOString() || "") !== (value?.toISOString() || "");
  });

  if (!changedFields.length) return { error: "Nessun orario modificato." };

  await prisma.$transaction([
    prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        ...next,
        totalMinutes,
        status: clockInReal && clockOutReal ? "MANUALLY_EDITED" : "INCOMPLETE",
      },
    }),
    ...changedFields.map(([fieldName, value]) =>
      prisma.timeEntryEdit.create({
        data: {
          timeEntryId: entry.id,
          fieldName,
          oldValue: ((entry[fieldName as keyof typeof entry] as Date | null)?.toISOString() || null) as string | null,
          newValue: value?.toISOString() || null,
          note: `${note} (${session.shop})`,
        },
      }),
    ),
  ]);

  return { success: "Timbratura aggiornata e storico salvato." };
};

export default function TimeClockDashboard() {
  const { workers, entries, edits, clockUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const present = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "PRESENT").length;
  const paused = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "BREAK").length;
  const out = workers.length - present - paused;

  return (
    <s-page heading="Timbratura lavoratori">
      {actionData?.error ? <s-banner tone="critical">{actionData.error}</s-banner> : null}
      {actionData?.success ? <s-banner tone="success">{actionData.success}</s-banner> : null}

      <s-section heading="Stato in tempo reale">
        <div className="tc-stats">
          <div>
            <strong>{present}</strong>
            <span>Presenti</span>
          </div>
          <div>
            <strong>{paused}</strong>
            <span>In pausa</span>
          </div>
          <div>
            <strong>{out}</strong>
            <span>Usciti</span>
          </div>
        </div>
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Lavoratore</th>
                <th>Sede</th>
                <th>Stato</th>
                <th>Ingresso</th>
                <th>Pausa</th>
                <th>Uscita</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => {
                const entry = worker.timeEntries[0];
                const status = currentStatus(entry);
                return (
                  <tr key={worker.id}>
                    <td>{worker.name}</td>
                    <td>{worker.location?.name || "-"}</td>
                    <td>
                      <span className={`tc-badge tc-badge-${status.toLowerCase()}`}>{statusLabel(status)}</span>
                    </td>
                    <td>{entry?.clockInReal ? new Date(entry.clockInReal).toLocaleTimeString("it-IT") : "-"}</td>
                    <td>
                      {entry?.breakStartReal ? new Date(entry.breakStartReal).toLocaleTimeString("it-IT") : "-"}
                      {entry?.breakEndReal ? ` - ${new Date(entry.breakEndReal).toLocaleTimeString("it-IT")}` : ""}
                    </td>
                    <td>{entry?.clockOutReal ? new Date(entry.clockOutReal).toLocaleTimeString("it-IT") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </s-section>

      <s-section heading="Timbrature recenti e correzioni">
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Lavoratore</th>
                <th>Reale</th>
                <th>Totale</th>
                <th>Correzione manuale</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.workDate).toLocaleDateString("it-IT")}</td>
                  <td>{entry.worker.name}</td>
                  <td>
                    {entry.clockInReal ? new Date(entry.clockInReal).toLocaleTimeString("it-IT") : "-"} /{" "}
                    {entry.clockOutReal ? new Date(entry.clockOutReal).toLocaleTimeString("it-IT") : "-"}
                  </td>
                  <td>{formatMinutes(entry.totalMinutes)}</td>
                  <td>
                    <details>
                      <summary>Modifica</summary>
                      <Form method="post" className="tc-edit-form">
                        <input type="hidden" name="entryId" value={entry.id} />
                        <label>
                          Ingresso
                          <input name="clockInReal" type="datetime-local" defaultValue={toDateTimeInput(entry.clockInReal)} />
                        </label>
                        <label>
                          Inizio pausa
                          <input
                            name="breakStartReal"
                            type="datetime-local"
                            defaultValue={toDateTimeInput(entry.breakStartReal)}
                          />
                        </label>
                        <label>
                          Fine pausa
                          <input name="breakEndReal" type="datetime-local" defaultValue={toDateTimeInput(entry.breakEndReal)} />
                        </label>
                        <label>
                          Uscita
                          <input name="clockOutReal" type="datetime-local" defaultValue={toDateTimeInput(entry.clockOutReal)} />
                        </label>
                        <label>
                          Nota obbligatoria
                          <textarea name="note" required placeholder="Motivo della modifica" />
                        </label>
                        <button type="submit">Salva correzione</button>
                      </Form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </s-section>

      <s-section heading="Storico modifiche">
        <div className="tc-audit-list">
          {edits.length ? (
            edits.map((edit) => (
              <div key={edit.id}>
                <strong>{edit.timeEntry.worker.name}</strong> · {edit.fieldName} ·{" "}
                {new Date(edit.createdAt).toLocaleString("it-IT")}
                <p>{edit.note}</p>
              </div>
            ))
          ) : (
            <p>Nessuna modifica manuale registrata.</p>
          )}
        </div>
      </s-section>

      <s-section slot="aside" heading="Link utili">
        <s-unordered-list>
          <s-list-item>
            <Link to="/app/workers">Gestisci lavoratori</Link>
          </s-list-item>
          <s-list-item>
            <Link to="/app/reports">Report mensile</Link>
          </s-list-item>
          <s-list-item>
            <a href={clockUrl} target="_blank" rel="noreferrer">
              Apri schermata lavoratore
            </a>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
