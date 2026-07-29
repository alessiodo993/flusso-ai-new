import Link from "next/link";

import { Logo } from "@/components/shell/logo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5"
          aria-label="Flusso, torna alla pagina iniziale"
        >
          <Logo />
          <span className="font-display text-lg">Flusso</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col px-5 sm:px-8">{children}</main>

      <footer className="px-5 pb-safe pt-10 text-xs text-ink-faint sm:px-8">
        Flusso — sistema personale di deep work.
      </footer>
    </div>
  );
}
