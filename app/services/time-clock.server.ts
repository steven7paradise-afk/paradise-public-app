import prisma from "../db.server";
import { hashPin } from "./auth.server";
import {
  calculateTotalMinutes,
  currentStatus,
  roundBackwardTo30,
  roundForwardTo30,
  startOfWorkDate,
} from "../utils/time-clock";

export type ClockAction = "clockIn" | "breakStart" | "breakEnd" | "clockOut";

export async function getWorkerByPin(shopId: string, pin: string) {
  return prisma.worker.findFirst({
    where: {
      shopId,
      pinHash: hashPin(pin),
      active: true,
    },
    include: {
      location: true,
      timeEntries: {
        where: { workDate: startOfWorkDate() },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

export async function getTodayEntry(workerId: string, shopId: string) {
  return prisma.timeEntry.findFirst({
    where: { workerId, shopId, workDate: startOfWorkDate() },
    orderBy: { createdAt: "desc" },
  });
}

export async function applyClockAction(shopId: string, workerId: string, action: ClockAction) {
  const now = new Date();
  const settings = await prisma.shopSettings.findUniqueOrThrow({ where: { id: shopId } });
  const worker = await prisma.worker.findFirstOrThrow({ where: { id: workerId, shopId, active: true } });
  const existing = await getTodayEntry(workerId, shopId);
  const status = currentStatus(existing);

  if (action === "clockIn") {
    if (status !== "OUT" || existing?.clockInReal) throw new Error("Ingresso gia registrato oggi.");

    return prisma.timeEntry.create({
      data: {
        shopId,
        workerId,
        locationId: worker.locationId,
        workDate: startOfWorkDate(now),
        clockInReal: now,
        clockInRounded: roundForwardTo30(now),
        breakPaidSnapshot: settings.breakPaid,
        status: "INCOMPLETE",
      },
    });
  }

  if (!existing?.clockInReal) throw new Error("Prima devi timbrare ingresso.");
  if (existing.clockOutReal) throw new Error("La giornata risulta gia chiusa.");

  const data: Record<string, Date | number | string> = {};

  if (action === "breakStart") {
    if (status !== "PRESENT") throw new Error("La pausa puo iniziare solo se sei presente.");
    data.breakStartReal = now;
    data.breakStartRounded = roundForwardTo30(now);
  }

  if (action === "breakEnd") {
    if (status !== "BREAK") throw new Error("Non risulti in pausa.");
    data.breakEndReal = now;
    data.breakEndRounded = roundBackwardTo30(now);
  }

  if (action === "clockOut") {
    if (status === "BREAK") throw new Error("Termina la pausa prima di uscire.");
    data.clockOutReal = now;
    data.clockOutRounded = roundBackwardTo30(now);
    data.status = "COMPLETE";
  }

  const merged = { ...existing, ...data };
  data.totalMinutes = calculateTotalMinutes({
    clockInRounded: merged.clockInRounded,
    clockOutRounded: merged.clockOutRounded,
    breakStartRounded: merged.breakStartRounded,
    breakEndRounded: merged.breakEndRounded,
    breakPaidSnapshot: merged.breakPaidSnapshot,
  });

  return prisma.timeEntry.update({
    where: { id: existing.id },
    data,
  });
}
