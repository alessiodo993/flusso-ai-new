import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { currentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "La tua giornata",
  robots: { index: false },
};

export default async function AppPage() {
  // Il middleware già protegge /app: questo è il secondo giro di chiave, per
  // le richieste che dovessero sfuggire al matcher.
  const user = await currentUser();
  if (!user) redirect("/login");

  return <AppShell />;
}
