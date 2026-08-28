import { redirect } from "next/navigation";
import { getClientFolders } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ClientsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ showInactive?: string }>;
}) {
  const { showInactive } = await searchParams;
  const clients = await getClientFolders();

  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-semibold">Clients</h1>
        <p className="text-sm text-neutral-500 mt-2">
          No client folders synced yet — click Sync now on the Summary tab to pull them from
          ClickUp.
        </p>
      </div>
    );
  }

  const first = clients.find((c) => c.active) ?? clients[0];
  redirect(`/clients/${first.folder_id}${showInactive ? "?showInactive=1" : ""}`);
}
