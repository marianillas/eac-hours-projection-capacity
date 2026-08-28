"use client";

import { useTransition, useState } from "react";
import { syncClientProjectsFromClickUp } from "@/lib/actions";

export function SyncProjectsButton({ folderId }: { folderId: string }) {
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
              await syncClientProjectsFromClickUp(folderId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sync failed.");
            }
          });
        }}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {isPending ? "Syncing…" : "Sync projects from ClickUp"}
      </button>
      {error && <span className="text-xs text-red-600 max-w-xs text-right">{error}</span>}
    </div>
  );
}
