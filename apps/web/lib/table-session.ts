"use client";

import type { ResolvedTable } from "@/lib/api";

const TABLE_SESSION_KEY = "al-arab-table-session";
const LEGACY_TABLE_SESSION_KEY = "al-arab-table-number";

export type TableSession = ResolvedTable & {
  token: string;
};

export type TableQrInput = {
  token?: string;
  legacyTableNumber?: string;
};

export function normalizeTableToken(value: string | null | undefined) {
  if (!value) return null;

  const token = value.trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : null;
}

export function normalizeLegacyTableNumber(value: string | null | undefined) {
  if (!value) return null;

  const tableNumber = value.trim();
  return /^\d{1,3}$/.test(tableNumber) && Number(tableNumber) > 0 ? tableNumber : null;
}

export function parseTableQrPayload(value: string, baseUrl = "https://al-arab.local") {
  const payload = value.trim();
  if (!payload) return null;

  try {
    const url = new URL(payload, baseUrl);
    const isMenuPath = url.pathname === "/menu" || url.pathname === "/mobile";
    if (!isMenuPath) return null;

    const token = normalizeTableToken(url.searchParams.get("t"));
    const legacyTableNumber = normalizeLegacyTableNumber(url.searchParams.get("table"));
    if (!token && !legacyTableNumber) return null;

    return {
      ...(token ? { token } : {}),
      ...(legacyTableNumber ? { legacyTableNumber } : {})
    } satisfies TableQrInput;
  } catch {
    return null;
  }
}

function isTableSession(value: unknown): value is TableSession {
  if (!value || typeof value !== "object") return false;

  const session = value as Partial<TableSession>;
  return (
    typeof session.id === "string" &&
    typeof session.tableNumber === "number" &&
    Number.isInteger(session.tableNumber) &&
    session.tableNumber > 0 &&
    typeof session.label === "string" &&
    Boolean(session.label.trim()) &&
    Boolean(normalizeTableToken(session.token))
  );
}

export function readStoredTableSession() {
  if (typeof window === "undefined") return null;

  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(TABLE_SESSION_KEY) ?? "null");
    return isTableSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readStoredTableNumber() {
  const session = readStoredTableSession();
  return session ? String(session.tableNumber) : null;
}

export function persistTableSession(table: ResolvedTable, token: string) {
  const normalizedToken = normalizeTableToken(token);
  if (!normalizedToken) return null;

  const session: TableSession = { ...table, token: normalizedToken };
  if (typeof window === "undefined") return session;

  try {
    window.sessionStorage.setItem(TABLE_SESSION_KEY, JSON.stringify(session));
    window.sessionStorage.removeItem(LEGACY_TABLE_SESSION_KEY);
  } catch {
    // The in-memory session still keeps checkout functional when storage is blocked.
  }
  return session;
}

export function clearTableSession() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(TABLE_SESSION_KEY);
    window.sessionStorage.removeItem(LEGACY_TABLE_SESSION_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function getCheckoutPath() {
  return "/checkout";
}
