import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import prisma from "../db.server";
import { findPublicShop } from "../services/shop-settings.server";
import { currentStatus, formatMinutes, startOfWorkDate, statusLabel } from "../utils/time-clock";
import "../styles/time-clock.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = await findPublicShop(url.searchParams.get("shop")) || (await prisma.shopSettings.findFirst());

  if (!shop) {
    return { shop: null, workers: [], entries: [], edits: [], leaveRequests: [] };
  }

  const today = startOfWorkDate();
  const [workers, entries, edits, leaveRequests] = await Promise.all([
    prisma.worker.findMany({
      where: { shopId: shop.id },
      include: {
        location: true,
        timeEntries: {
          where: { workDate: today },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.timeEntry.findMany({
      where: { shopId: shop.id },
      include: { worker: true, location: true },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.timeEntryEdit.findMany({
      where: { timeEntry: { shopId: shop.id } },
      include: { timeEntry: { include: { worker: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { shopId: shop.id },
      include: { worker: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return { shop, workers, entries, edits, leaveRequests };
};

export default function AdminDemoPage() {
  const { shop, workers, entries, edits, leaveRequests } = useLoaderData<typeof loader>();

  const present = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "PRESENT").length;
  const paused = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "BREAK").length;
  const out = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "OUT").length;
  const incomplete = entries.filter((entry) => !entry.clockOutReal).length;

  if (!shop) {
    return (
      <main className="admin-demo-page">
        <section className="admin-demo-empty">Apri prima l'app admin o crea un lavoratore demo.</section>
      </main>
    );
  }

  return (
    <main className="admin-demo-page">
      <aside className="admin-demo-sidebar">
        <img src="/paradise-logo-black.svg" alt="Paradise" />
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#workers">Lavoratori</a>
          <a href="#entries">Timbrature</a>
          <a href="#requests">Permessi</a>
          <a href="#reports">Report</a>
        </nav>
      </aside>

      <section className="admin-demo-content">
        <header className="admin-demo-header">
          <div>
            <p>Pannello amministratore</p>
            <h1>{shop.companyName || "Paradise"}</h1>
          </div>
          <Link to={`/clock?shop=${shop.shop}`}>Apri schermata lavoratore</Link>
        </header>

        <section id="dashboard" className="admin-demo-stats">
          <div>
            <span>Presenti</span>
            <strong>{present}</strong>
          </div>
          <div>
            <span>In pausa</span>
            <strong>{paused}</strong>
          </div>
          <div>
            <span>Usciti</span>
            <strong>{out}</strong>
          </div>
          <div>
            <span>Incomplete</span>
            <strong>{incomplete}</strong>
          </div>
        </section>

        <section id="workers" className="admin-demo-panel">
          <div className="admin-demo-panel-title">
            <h2>Stato lavoratori</h2>
            <span>{workers.length} totali</span>
          </div>
          <div className="admin-demo-worker-grid">
            {workers.map((worker) => {
              const status = currentStatus(worker.timeEntries[0]);
              return (
                <article key={worker.id}>
                  {worker.photoUrl ? (
                    <img src={worker.photoUrl} alt="" />
                  ) : (
                    <div>{worker.name.charAt(0).toUpperCase()}</div>
                  )}
                  <h3>{worker.name}</h3>
                  <p>{worker.role || worker.location?.name || "Lavoratore"}</p>
                  <span className={`tc-badge tc-badge-${status.toLowerCase()}`}>{statusLabel(status)}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section id="entries" className="admin-demo-panel">
          <div className="admin-demo-panel-title">
            <h2>Timbrature recenti</h2>
            <span>Ore e correzioni</span>
          </div>
          <div className="tc-table-wrap">
            <table className="tc-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lavoratore</th>
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
                    <td>{entry.clockInReal ? new Date(entry.clockInReal).toLocaleTimeString("it-IT") : "-"}</td>
                    <td>{entry.clockOutReal ? new Date(entry.clockOutReal).toLocaleTimeString("it-IT") : "-"}</td>
                    <td>{formatMinutes(entry.totalMinutes)}</td>
                    <td>{entry.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-demo-split">
          <div id="requests" className="admin-demo-panel">
            <div className="admin-demo-panel-title">
              <h2>Permessi</h2>
              <span>Da approvare</span>
            </div>
            {leaveRequests.length ? (
              leaveRequests.map((request) => (
                <div className="admin-demo-list-row" key={request.id}>
                  <strong>{request.worker.name}</strong>
                  <span>{request.reason}</span>
                  <em>{request.status}</em>
                </div>
              ))
            ) : (
              <p className="admin-demo-muted">Nessuna richiesta permesso.</p>
            )}
          </div>

          <div id="reports" className="admin-demo-panel">
            <div className="admin-demo-panel-title">
              <h2>Storico modifiche</h2>
              <span>Audit log</span>
            </div>
            {edits.length ? (
              edits.map((edit) => (
                <div className="admin-demo-list-row" key={edit.id}>
                  <strong>{edit.timeEntry.worker.name}</strong>
                  <span>{edit.fieldName}</span>
                  <em>{new Date(edit.createdAt).toLocaleDateString("it-IT")}</em>
                </div>
              ))
            ) : (
              <p className="admin-demo-muted">Nessuna modifica manuale.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
