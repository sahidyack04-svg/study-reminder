import { randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function isTokenExpired(expiresAt: Date, asOf: Date = new Date()): boolean {
  return asOf.getTime() >= expiresAt.getTime();
}

export function tokenExpiryDate(hoursFromNow: number, asOf: Date = new Date()): Date {
  return new Date(asOf.getTime() + hoursFromNow * 60 * 60 * 1000);
}
