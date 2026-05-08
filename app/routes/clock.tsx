import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { Form, useActionData, useLoaderData, useLocation } from "react-router";

import prisma from "../db.server";
import { validPin } from "../services/auth.server";
import { findPublicShop } from "../services/shop-settings.server";
import { applyClockAction, getWorkerByPin } from "../services/time-clock.server";
import { currentStatus, statusLabel } from "../utils/time-clock";
import "../styles/time-clock.css";

const storefrontStyles = `
  .clock-page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0;padding:0 20px 28px;background:linear-gradient(180deg,#f4c8df 0 52%,#fff 52% 100%);color:#171015;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .clock-header{width:min(100%,460px);display:flex;justify-content:space-between;align-items:center;min-height:128px;margin-top:clamp(46px,14vh,150px);padding:0 2px 16px}
  .clock-header-logo{width:154px;max-width:52%;max-height:76px;object-fit:contain}
  .clock-datetime{display:grid;gap:4px;color:#6a565f;text-align:right}.clock-datetime span{font-size:14px;font-weight:760;text-transform:capitalize}.clock-datetime strong{color:#221f20;font-size:28px;line-height:1;font-weight:850;letter-spacing:0}
  .clock-panel{width:min(100%,460px);border:1px solid rgba(34,31,32,.08);border-radius:14px;padding:28px 26px 26px;background:#fff;box-shadow:0 24px 70px rgba(89,42,66,.14);text-align:center}
  .clock-panel-heading{margin-bottom:26px}.clock-panel-heading p{margin:0 0 6px;color:#8f7781;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.clock-panel h1{margin:0;font-size:34px;line-height:1.1;letter-spacing:0}
  .clock-pin-form,.clock-worker,.clock-leave form{display:grid;gap:14px}.clock-pin-form label,.clock-leave label{display:grid;gap:6px;color:#3b2d31;font-size:13px;font-weight:650}
  .clock-pin-form input,.clock-leave input,.clock-leave textarea{width:100%;box-sizing:border-box;border:1px solid #e2c0cf;border-radius:8px;padding:10px 12px;font:inherit;background:#fffdfd}
  .clock-pin-form input{text-align:center;font-size:31px;letter-spacing:0;font-weight:800;min-height:64px;color:#221f20}.clock-pin-form small{margin-top:-6px;color:#6d5960;font-size:13px}
  .clock-page button,.clock-exit-link{border:0;border-radius:8px;padding:11px 16px;background:#160b12;color:#fff;font-weight:750;cursor:pointer;text-decoration:none;text-align:center;box-shadow:0 10px 18px rgba(22,11,18,.12)}
  .clock-pin-form button,.clock-actions button{min-height:52px;font-size:16px}.clock-secondary{display:block;background:#fff!important;color:#171015!important;border:1px solid #d8c7cc!important;box-shadow:none!important}
  .clock-worker-card{display:flex;align-items:center;gap:16px;text-align:left;border:1px solid rgba(34,31,32,.08);border-radius:12px;padding:14px;background:#fff8fb}.clock-avatar{width:82px;height:82px;border-radius:50%;object-fit:cover;background:#f6cfe4;flex:0 0 auto}.clock-avatar-initial{display:grid;place-items:center;border:1px solid rgba(34,31,32,.08);color:#221f20;font-size:34px;font-weight:800}
  .clock-worker h2{margin:0;font-size:24px}.clock-worker p{margin:4px 0 10px;color:#6d5960}.clock-status{display:inline-flex;align-items:center;border-radius:999px;padding:6px 12px;font-size:13px}.clock-status-present{background:#d9f4e4;color:#0f6b3f}.clock-status-break{background:#fff2c7;color:#765000}.clock-status-out{background:#ece7e9;color:#5d5055}
  .clock-actions{display:grid;gap:10px}.clock-actions form,.clock-actions button{width:100%}.clock-leave{text-align:left;border-top:1px solid #eadde1;padding-top:12px}.clock-leave summary{cursor:pointer;font-weight:750;text-align:center;min-height:44px;display:grid;place-items:center}
  .clock-error,.clock-success{border-radius:8px;padding:10px 12px;font-weight:650}.clock-error{background:#ffe4e4;color:#8a1f1f}.clock-success{background:#d9f4e4;color:#0f6b3f}
  @media(max-width:520px){.clock-page{padding:0 16px 22px}.clock-header{min-height:96px;margin-top:34px;padding-bottom:12px}.clock-header-logo{width:132px;max-width:50%}.clock-datetime span{font-size:12px}.clock-datetime strong{font-size:22px}.clock-panel{padding:22px 18px;border-radius:12px}.clock-panel h1{font-size:28px}.clock-worker-card{align-items:flex-start}}
`;

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

function LiveClock({ dateLabel }: { dateLabel: string }) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="clock-datetime">
      <span>{dateLabel}</span>
      <strong>{time}</strong>
    </div>
  );
}

export default function ClockPage() {
  const { shop, shopParam, todayLabel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const worker = actionData && "worker" in actionData ? actionData.worker : null;
  const status = actionData && "status" in actionData ? actionData.status : undefined;
  const pin = actionData && "pin" in actionData ? actionData.pin : "";
  const appUrl = "https://paradise-public-app.onrender.com";
  const logoSrc = shop?.logoUrl || `${appUrl}/paradise-logo-black.svg`;
  const workerInitial = worker?.name?.trim()?.charAt(0)?.toUpperCase() || "?";
  const isStorefrontProxy = location.pathname.includes("/apps/timbratura");
  const cleanAction = isStorefrontProxy ? "/apps/timbratura" : `/clock?shop=${encodeURIComponent(shopParam)}`;
  const cleanExit = cleanAction;

  return (
    <main className="clock-page">
      <style dangerouslySetInnerHTML={{ __html: storefrontStyles }} />
      <header className="clock-header">
        <img className="clock-header-logo" src={logoSrc} alt={shop?.companyName || "Paradise"} />
        <LiveClock dateLabel={todayLabel} />
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
          <Form method="post" action={cleanAction} className="clock-pin-form">
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
                <Form method="post" action={cleanAction} key={intent}>
                  <input type="hidden" name="shop" value={shopParam} />
                  <input type="hidden" name="pin" value={pin} />
                  <input type="hidden" name="intent" value={intent} />
                  <button type="submit">{label}</button>
                </Form>
              ))}
            </div>

            <details className="clock-leave">
              <summary>Chiedi permesso</summary>
              <Form method="post" action={cleanAction}>
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

            <a className="clock-secondary clock-exit-link" href={cleanExit}>
              Esci
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
