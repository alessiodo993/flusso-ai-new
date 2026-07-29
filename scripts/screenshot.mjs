/**
 * Screenshot delle schermate principali, per verificare il layout senza
 * aprire un browser a mano.
 *
 *   npm run dev            # in un terminale
 *   node scripts/screenshot.mjs .tmp/shots
 *
 * Il percorso del browser si può forzare con CHROMIUM_PATH; altrimenti si usa
 * quello che Playwright ha scaricato.
 */
import { mkdir } from "node:fs/promises";

import { chromium } from "playwright";

const outDir = process.argv[2] ?? ".tmp/shots";
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const SHOTS = [
  { name: "app-desktop", path: "/anteprima", width: 1440, height: 900 },
  { name: "app-mobile", path: "/anteprima", width: 390, height: 844 },
  { name: "landing", path: "/", width: 1440, height: 900 },
  { name: "login", path: "/login", width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);

let failures = 0;

for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
  });

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page
    .goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" })
    .catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${outDir}/${shot.name}.png` });

  // Senza un Supabase vero le query falliscono: quel rumore non è un difetto.
  const real = errors.filter(
    (error) => !/supabase|Failed to fetch|net::ERR|ERR_NAME/i.test(error),
  );
  if (real.length > 0) failures += 1;
  console.log(
    `${shot.name}: ${real.length ? `ERRORI → ${real.slice(0, 3).join(" | ")}` : "ok"}`,
  );

  await page.close();
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
