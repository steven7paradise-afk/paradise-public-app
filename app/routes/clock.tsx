import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import prisma from "../db.server";
import { validPin } from "../services/auth.server";
import { findPublicShop } from "../services/shop-settings.server";
import { applyClockAction, getWorkerByPin } from "../services/time-clock.server";
import { currentStatus, statusLabel } from "../utils/time-clock";
import "../styles/time-clock.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = await findPublicShop(url.searchParams.get("shop"));
  return {
    shop,
    shopParam: url.searchParams.get("shop") || shop?.shop || "",
    todayLabel: new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shopDomain = String(formData.get("shop") || "");
  const shop = await findPublicShop(shopDomain);
  const pin = String(formData.get("pin") || "").trim();
  const intent = String(formData.get("intent") || "verify");

  if (!shop) return { error: "Negozio non configurato. Apri prima l'app admin e salva le impostazioni." };
  if (!validPin(pin)) return { error: "Inserisci un PIN di 4 cifre." };

  const worker = await getWorkerByPin(shop.id, pin);
  if (!worker) return { error: "PIN non valido o lavoratore disattivato." };

  if (intent === "leaveRequest") {
    const date = String(formData.get("date") || "");
    const startTime = String(formData.get("startTime") || "");
    const endTime = String(formData.get("endTime") || "");
    const reason = String(formData.get("reason") || "").trim();

    if (!date || !startTime || !reason) return { error: "Compila giorno, ora e motivo.", pin };

    await prisma.leaveRequest.create({
      data: {
        shopId: shop.id,
        workerId: worker.id,
        date: new Date(`${date}T00:00`),
        startTime: new Date(`${date}T${startTime}`),
        endTime: endTime ? new Date(`${date}T${endTime}`) : null,
        reason,
      },
    });

    return {
      success: "Richiesta permesso inviata. Le email saranno collegate nella prossima fase.",
      pin,
      worker,
      status: currentStatus(worker.timeEntries[0]),
    };
  }

  if (["clockIn", "breakStart", "breakEnd", "clockOut"].includes(intent)) {
    try {
      await applyClockAction(shop.id, worker.id, intent as "clockIn" | "breakStart" | "breakEnd" | "clockOut");
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Azione non riuscita.",
        pin,
        worker,
        status: currentStatus(worker.timeEntries[0]),
      };
    }

    const updatedWorker = await getWorkerByPin(shop.id, pin);
    return {
      success: "Timbratura registrata.",
      pin,
      worker: updatedWorker,
      status: currentStatus(updatedWorker?.timeEntries[0]),
    };
  }

  return { pin, worker, status: currentStatus(worker.timeEntries[0]) };
};

function actionButtons(status?: string) {
  if (status === "PRESENT") {
    return [
      ["breakStart", "Inizia pausa"],
      ["clockOut", "Timbra uscita"],
    ];
  }
  if (status === "BREAK") return [["breakEnd", "Fine pausa"]];
  return [["clockIn", "Timbra ingresso"]];
}

export default function ClockPage() {
  const { shop, shopParam, todayLabel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const worker = actionData && "worker" in actionData ? actionData.worker : null;
  const status = actionData && "status" in actionData ? actionData.status : undefined;
  const pin = actionData && "pin" in actionData ? actionData.pin : "";
  const logoSrc = shop?.logoUrl || "/paradise-logo-black.svg";
  const workerInitial = worker?.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <main className="clock-page">
      <header className="clock-header">
        <img className="clock-header-logo" src={logoSrc} alt={shop?.companyName || "Paradise"} />
        <span>{todayLabel}</span>
      </header>
      <section className="clock-panel">
        <div className="clock-panel-heading">
          <p>Area lavoratori</p>
          <h1>Timbratura</h1>
        </div>

        {actionData && "error" in actionData && actionData.error ? <p className="clock-error">{actionData.error}</p> : null}
        {actionData && "success" in actionData && actionData.success ? (
          <p className="clock-success">{actionData.success}</p>
        ) : null}

        {!worker ? (
          <Form method="post" className="clock-pin-form">
            <input type="hidden" name="shop" value={shopParam} />
            <input type="hidden" name="intent" value="verify" />
            <label htmlFor="pin">Codice PIN</label>
            <input
              id="pin"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              minLength={4}
              autoComplete="off"
              placeholder="0000"
              aria-describedby="pin-help"
              autoFocus
            />
            <small id="pin-help">Inserisci le 4 cifre del tuo codice personale.</small>
            <button type="submit">Entra</button>
          </Form>
        ) : (
          <div className="clock-worker">
            <div className="clock-worker-card">
              {worker.photoUrl ? (
                <img className="clock-avatar" src={worker.photoUrl} alt="" />
              ) : (
                <div className="clock-avatar clock-avatar-initial" aria-hidden="true">
                  {workerInitial}
                </div>
              )}
              <div>
                <h2>{worker.name}</h2>
                <p>{worker.role || worker.location?.name || ""}</p>
                <strong className={`clock-status clock-status-${String(status || "OUT").toLowerCase()}`}>
                  {statusLabel(String(status || "OUT"))}
                </strong>
              </div>
            </div>

            <div className="clock-actions">
              {actionButtons(String(status || "OUT")).map(([intent, label]) => (
                <Form method="post" key={intent}>
                  <input type="hidden" name="shop" value={shopParam} />
                  <input type="hidden" name="pin" value={pin} />
                  <input type="hidden" name="intent" value={intent} />
                  <button type="submit">{label}</button>
                </Form>
              ))}
            </div>

            <details className="clock-leave">
              <summary>Chiedi permesso</summary>
              <Form method="post">
                <input type="hidden" name="shop" value={shopParam} />
                <input type="hidden" name="pin" value={pin} />
                <input type="hidden" name="intent" value="leaveRequest" />
                <label>
                  Giorno
                  <input name="date" type="date" required />
                </label>
                <label>
                  Ora inizio
                  <input name="startTime" type="time" required />
                </label>
                <label>
                  Ora fine
                  <input name="endTime" type="time" />
                </label>
                <label>
                  Motivo
                  <textarea name="reason" required />
                </label>
                <button type="submit">Invia richiesta</button>
              </Form>
            </details>

            <a className="clock-secondary clock-exit-link" href={`/clock?shop=${encodeURIComponent(shopParam)}`}>
              Esci
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
