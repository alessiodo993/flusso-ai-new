"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/shell/theme-provider";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // I dati di Flusso sono di un solo utente e cambiano solo per sua
        // azione: rileggerli a ogni focus della finestra è rumore inutile.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Un client per montaggio: creato nello state, mai a modulo, altrimenti
  // in SSR verrebbe condiviso fra richieste diverse.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "panel-lift",
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
