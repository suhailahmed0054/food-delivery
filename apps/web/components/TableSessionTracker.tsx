"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { resolveTableQr } from "@/lib/api";
import {
  clearTableSession,
  normalizeLegacyTableNumber,
  normalizeTableToken,
  persistTableSession,
  readStoredTableSession,
  type TableSession
} from "@/lib/table-session";

type TableSessionTrackerProps = {
  onTableChange?: (session: TableSession | null) => void;
  onError?: (message: string) => void;
  onLoadingChange?: (isLoading: boolean) => void;
};

export function TableSessionTracker({
  onTableChange,
  onError,
  onLoadingChange
}: TableSessionTrackerProps) {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("t");
  const legacyTableParam = searchParams.get("table");

  useEffect(() => {
    const token = normalizeTableToken(tokenParam);
    const legacyTableNumber = normalizeLegacyTableNumber(legacyTableParam);

    if (!token && !legacyTableNumber) {
      onTableChange?.(readStoredTableSession());
      onLoadingChange?.(false);
      return;
    }

    let cancelled = false;
    clearTableSession();
    onTableChange?.(null);
    onError?.("");
    onLoadingChange?.(true);

    void resolveTableQr({
      ...(token ? { token } : {}),
      ...(legacyTableNumber ? { legacyTableNumber } : {})
    })
      .then((table) => {
        if (cancelled) return;
        const resolvedToken = token ?? table.token;
        const session = resolvedToken ? persistTableSession(table, resolvedToken) : null;
        onTableChange?.(session);
        if (!session) onError?.("This table QR code could not be verified.");
      })
      .catch((error) => {
        if (cancelled) return;
        clearTableSession();
        onTableChange?.(null);
        onError?.(error instanceof Error ? error.message : "This table QR code is invalid or inactive.");
      })
      .finally(() => {
        if (!cancelled) onLoadingChange?.(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    legacyTableParam,
    onError,
    onLoadingChange,
    onTableChange,
    tokenParam
  ]);

  return null;
}
