import type { LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { ensureShopSettings } from "../services/shop-settings.server";
import { formatMinutes } from "../utils/time-clock";

function monthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  return { start, end };
}

function csvEscape(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopSettings(session.shop);
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const workerId = url.searchParams.get("workerId") || "";
  const { start, end } = monthRange(month);

  const [workers, entries] = await Promise.all([
    prisma.worker.findMany({ where: { shopId: shop.id }, orderBy: { name: "asc" } }),
    prisma.timeEntry.findMany({
      where: {
        shopId: shop.id,
        workDate: { gte: start, lt: end },
        ...(workerId ? { workerId } : {}),
      },
      include: { worker: true, location: true },
      orderBy: [{ workDate: "asc" }, { worker: { name: "asc" } }],
    }),
  ]);

  if (url.searchParams.get("export") === "csv") {
    const header = ["Data", "Lavoratore", "Sede", "Ingresso reale", "Uscita reale", "Totale minuti", "Totale"];
    const rows = entries.map((entry) => [
      new Date(entry.workDate).toLocaleDateString("it-IT"),
      entry.worker.name,
      entry.location?.name || "",
      entry.clockInReal ? new Date(entry.clockInReal).toLocaleString("it-IT") : "",
      entry.clockOutReal ? new Date(entry.clockOutReal).toLocaleString("it-IT") : "",
      entry.totalMinutes,
      formatMinutes(entry.totalMinutes),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-timbrature-${month}.csv"`,
      },
    });
  }

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
  return { month, workerId, workers, entries, totalMinutes };
};

export default function ReportsPage() {
  const { month, workerId, workers, entries, totalMinutes } = useLoaderData<typeof loader>();
  const query = new URLSearchParams({ month, ...(workerId ? { workerId } : {}), export: "csv" });

  return (
    <s-page heading="Report mensile">
      <s-section heading="Filtri">
        <Form method="get" className="tc-inline-form">
          <input name="month" type="month" defaultValue={month} />
          <select name="workerId" defaultValue={workerId}>
            <option value="">Tutti i lavoratori</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
          <button type="submit">Aggiorna</button>
          <a className="tc-button-link" href={`/app/reports?${query.toString()}`}>
            Esporta CSV
          </a>
        </Form>
      </s-section>

      <s-section heading={`Totale ${formatMinutes(totalMinutes)}`}>
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Lavoratore</th>
                <th>Sede</th>
                <th>Ingresso</th>
                <th>Uscita</th>
                <th>Totale</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.workDate).toLocaleDateString("it-IT")}</td>
                  <td>{entry.worker.name}</td>
                  <td>{entry.location?.name || "-"}</td>
                  <td>{entry.clockInReal ? new Date(entry.clockInReal).toLocaleTimeString("it-IT") : "-"}</td>
                  <td>{entry.clockOutReal ? new Date(entry.clockOutReal).toLocaleTimeString("it-IT") : "-"}</td>
                  <td>{formatMinutes(entry.totalMinutes)}</td>
                  <td>{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </s-section>
    </s-page>
  );
}
