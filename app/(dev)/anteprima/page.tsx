import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";

/**
 * La shell senza autenticazione, per guardarla in sviluppo e per gli
 * screenshot di verifica del layout. In produzione non esiste.
 */
export default function AnteprimaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AppShell />;
}
