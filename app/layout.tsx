import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Work_Sans } from "next/font/google";

import { Providers } from "@/components/providers";
import { THEME_BOOTSTRAP } from "@/components/shell/theme-script";

import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Flusso — dal pensiero al blocco di calendario",
    template: "%s · Flusso",
  },
  description:
    "Flusso collega gli obiettivi del trimestre ai blocchi di calendario che esegui davvero, e usa i tuoi dati per rendere realistico il piano di domani.",
  applicationName: "Flusso",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Flusso", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Flusso", locale: "it_IT" },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#14171a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} h-full`}
    >
      <head>
        {/* Risolve il tema prima del primo paint: nessun lampo di bianco. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
