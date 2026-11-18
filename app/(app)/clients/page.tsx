import { Suspense } from "react";
import { listClients } from "@/lib/actions/clients";
import ClientsView from "./clients-view";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">กำลังโหลด...</p>}>
      <ClientsView initialClients={clients} />
    </Suspense>
  );
}
