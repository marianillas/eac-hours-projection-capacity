"use client";

import { useTransition, useState } from "react";
import { triggerSync } from "@/lib/actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await triggerSync();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sync failed.");
            }
          });
        }}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {isPending ? "Syncing…" : "Sync now"}
      </button>
      {error && <span className="text-xs text-red-600 max-w-xs text-right">{error}</span>}
    </div>
  );
}
