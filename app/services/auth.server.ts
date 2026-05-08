import crypto from "node:crypto";

const salt = process.env.TIME_CLOCK_SECRET || process.env.SHOPIFY_API_SECRET || "paradise-time-clock-dev";

export function hashSecret(value: string) {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function hashPin(pin: string) {
  return hashSecret(pin.trim());
}

export function validPin(pin: string) {
  return /^\d{4}$/.test(pin.trim());
}
