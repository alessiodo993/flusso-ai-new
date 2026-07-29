import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reimposta la password",
  description: "Richiedi un link per scegliere una nuova password di Flusso.",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
      <ResetPasswordForm />
    </div>
  );
}
