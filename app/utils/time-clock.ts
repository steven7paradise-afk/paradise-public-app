export function roundForwardTo30(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 30;

  if (remainder !== 0) {
    rounded.setMinutes(minutes + (30 - remainder));
  }

  return rounded;
}

export function roundBackwardTo30(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.floor(rounded.getMinutes() / 30) * 30);
  return rounded;
}

export function startOfWorkDate(date = new Date()) {
  const workDate = new Date(date);
  workDate.setHours(0, 0, 0, 0);
  return workDate;
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.abs(totalMinutes % 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function currentStatus(entry?: {
  clockInReal: Date | string | null;
  breakStartReal: Date | string | null;
  breakEndReal: Date | string | null;
  clockOutReal: Date | string | null;
} | null) {
  if (!entry?.clockInReal || entry.clockOutReal) return "OUT";
  if (entry.breakStartReal && !entry.breakEndReal) return "BREAK";
  return "PRESENT";
}

export function statusLabel(status: string) {
  if (status === "PRESENT") return "Presente";
  if (status === "BREAK") return "In pausa";
  return "Uscito";
}

export function calculateTotalMinutes(entry: {
  clockInRounded: Date | null;
  clockOutRounded: Date | null;
  breakStartRounded: Date | null;
  breakEndRounded: Date | null;
  breakPaidSnapshot: boolean;
}) {
  if (!entry.clockInRounded || !entry.clockOutRounded) return 0;

  const worked = entry.clockOutRounded.getTime() - entry.clockInRounded.getTime();
  let breakMs = 0;

  if (!entry.breakPaidSnapshot && entry.breakStartRounded && entry.breakEndRounded) {
    breakMs = Math.max(0, entry.breakEndRounded.getTime() - entry.breakStartRounded.getTime());
  }

  return Math.max(0, Math.round((worked - breakMs) / 60000));
}
