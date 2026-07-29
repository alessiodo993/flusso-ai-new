import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Accedi",
  description:
    "Entra in Flusso per catturare, pianificare ed eseguire la tua giornata.",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
