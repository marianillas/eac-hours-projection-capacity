import Link from "next/link";
import type { ClientFolder } from "@/lib/data";

export function ClientSidebar({
  clients,
  selectedFolderId,
  showInactive,
}: {
  clients: ClientFolder[];
  selectedFolderId?: string;
  showInactive: boolean;
}) {
  const inactiveCount = clients.filter((c) => !c.active).length;
  const visible = showInactive ? clients : clients.filter((c) => c.active);
  const toggleHref = showInactive ? "/clients" : "/clients?showInactive=1";

  return (
    <aside className="w-56 shrink-0 rounded-lg border border-neutral-200 bg-white h-fit overflow-hidden">
      <nav className="flex flex-col py-1">
        {visible.map((c) => {
          const isSelected = c.folder_id === selectedFolderId;
          return (
            <Link
              key={c.folder_id}
              href={`/clients/${c.folder_id}${showInactive ? "?showInactive=1" : ""}`}
              className={`px-4 py-2 text-sm truncate ${
                isSelected
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50"
              } ${!c.active ? "italic text-neutral-400" : ""}`}
            >
              {c.name}
            </Link>
          );
        })}
      </nav>
      {inactiveCount > 0 && (
        <Link
          href={toggleHref}
          className="block border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500 hover:bg-neutral-50"
        >
          {showInactive ? "Hide inactive" : `Show inactive (${inactiveCount})`}
        </Link>
      )}
    </aside>
  );
}
