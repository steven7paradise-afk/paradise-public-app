import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";

import prisma from "../db.server";
import { requireResponsible } from "../services/responsible-auth.server";
import { currentStatus, formatMinutes, startOfWorkDate, statusLabel } from "../utils/time-clock";
import "../styles/time-clock.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const admin = await requireResponsible(request);
  const shop = admin.shop;
  const today = startOfWorkDate();

  const [workers, entries, leaveRequests] = await Promise.all([
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
      take: 12,
    }),
    prisma.leaveRequest.findMany({
      where: { shopId: shop.id },
      include: { worker: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    admin: { name: admin.name, email: admin.email, role: admin.role },
    shop,
    workers,
    entries,
    leaveRequests,
  };
};

export default function ResponsibleDashboardPage() {
  const { admin, shop, workers, entries, leaveRequests } = useLoaderData<typeof loader>();
  const present = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "PRESENT").length;
  const paused = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "BREAK").length;
  const out = workers.filter((worker) => currentStatus(worker.timeEntries[0]) === "OUT").length;

  return (
    <main className="responsible-admin-page">
      <aside className="responsible-sidebar">
        <img src="/paradise-logo-black.svg" alt="Paradise Beauty" />
        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#team">Team</a>
          <a href="#entries">Timbrature</a>
          <a href="#permessi">Permessi</a>
        </nav>
      </aside>

      <section className="responsible-content">
        <header className="responsible-header">
          <div>
            <span>Pannello responsabile</span>
            <h1>{shop.companyName || "Paradise Beauty"}</h1>
            <p>{admin.name} · {admin.role}</p>
          </div>
          <div className="responsible-header-actions">
            <Link to="/admin/logout">Esci</Link>
            <a href="https://www.paradisebeauty.it/apps/timbratura" target="_blank" rel="noreferrer">
              Schermata lavoratore
            </a>
          </div>
        </header>

        <section id="dashboard" className="responsible-stats">
          <article>
            <span>Presenti</span>
            <strong>{present}</strong>
          </article>
          <article>
            <span>In pausa</span>
            <strong>{paused}</strong>
          </article>
          <article>
            <span>Usciti</span>
            <strong>{out}</strong>
          </article>
          <article>
            <span>Lavoratori</span>
            <strong>{workers.length}</strong>
          </article>
        </section>

        <section id="team" className="responsible-panel">
          <div className="responsible-panel-title">
            <h2>Stato lavoratori</h2>
            <span>Tempo reale</span>
          </div>
          <div className="responsible-worker-grid">
            {workers.map((worker) => {
              const status = currentStatus(worker.timeEntries[0]);
              return (
                <article key={worker.id}>
                  {worker.photoUrl ? <img src={worker.photoUrl} alt="" /> : <div>{worker.name.charAt(0).toUpperCase()}</div>}
                  <h3>{worker.name}</h3>
                  <p>{worker.role || worker.location?.name || "Lavoratore"}</p>
                  <span className={`tc-badge tc-badge-${status.toLowerCase()}`}>{statusLabel(status)}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section id="entries" className="responsible-panel">
          <div className="responsible-panel-title">
            <h2>Timbrature recenti</h2>
            <span>Ultimi movimenti</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="permessi" className="responsible-panel">
          <div className="responsible-panel-title">
            <h2>Permessi</h2>
            <span>Richieste recenti</span>
          </div>
          {leaveRequests.length ? (
            leaveRequests.map((request) => (
              <div className="responsible-list-row" key={request.id}>
                <strong>{request.worker.name}</strong>
                <span>{request.reason}</span>
                <em>{request.status}</em>
              </div>
            ))
          ) : (
            <p className="responsible-muted">Nessuna richiesta permesso.</p>
          )}
        </section>
      </section>
    </main>
  );
}
