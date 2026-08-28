import Link from "next/link";
import type { ClientFolder } from "@/lib/data";

export function ClientSidebar({
  clients,
  selectedFolderId,
}: {
  clients: ClientFolder[];
  selectedFolderId?: string;
}) {
  return (
    <aside className="w-56 shrink-0 rounded-lg border border-neutral-200 bg-white h-fit overflow-hidden">
      <nav className="flex flex-col py-1">
        {clients.map((c) => {
          const isSelected = c.folder_id === selectedFolderId;
          return (
            <Link
              key={c.folder_id}
              href={`/clients/${c.folder_id}`}
              className={`px-4 py-2 text-sm truncate ${
                isSelected
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {c.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
