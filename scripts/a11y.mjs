/**
 * Controllo di accessibilità con axe, sulle schermate vere.
 *
 *   npm run dev            # in un terminale
 *   node scripts/a11y.mjs  # in un altro
 *
 * Non sostituisce una prova con la tastiera e uno screen reader, ma prende
 * tutto ciò che è meccanico: contrasti, etichette mancanti, ruoli sbagliati,
 * campi senza nome accessibile.
 */
import { readFile } from "node:fs/promises";

import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
const axeSource = await readFile(
  new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
  "utf8",
);

/** Le schermate, e cosa aprire prima di guardarle. */
const SCREENS = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "app", path: "/anteprima" },
  {
    name: "impostazioni",
    path: "/anteprima",
    open: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(300);
      await page.getByText("Impostazioni", { exact: true }).first().click();
    },
  },
  {
    name: "pianifica",
    path: "/anteprima",
    open: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(300);
      await page.getByText("Pianifica con AI").click();
    },
  },
  {
    name: "shutdown",
    path: "/anteprima",
    open: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(300);
      await page.getByText("Chiudi la giornata").click();
    },
  },
  {
    name: "app-scuro",
    path: "/anteprima",
    // Il tema scuro ha i suoi token: un contrasto che passa in chiaro può
    // non passare qui, e viceversa.
    open: async (page) => {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        localStorage.setItem("flusso:tema", "dark");
      });
    },
  },
  {
    name: "obiettivi",
    path: "/anteprima",
    open: async (page) => {
      await page.getByText("Obiettivi", { exact: true }).first().click();
    },
  },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});

let violations = 0;

for (const screen of SCREENS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page
    .goto(`${baseUrl}${screen.path}`, { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.waitForTimeout(3500);

  if (screen.open) {
    await screen.open(page);
    await page.waitForTimeout(700);
  }

  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      /*
       * `meta-viewport` è escluso perché in sviluppo qualcosa nella catena di
       * Next inietta a runtime un `user-scalable=no` che non è nostro: non
       * compare nell'HTML servito e non compare affatto nella build di
       * produzione, dove il meta è
       * `width=device-width, initial-scale=1, viewport-fit=cover`.
       * Verificato con `next start`; tenerlo acceso qui segnalerebbe ogni
       * volta un difetto che l'utente non incontrerà mai.
       */
      rules: { "meta-viewport": { enabled: false } },
    }),
  );

  const found = results.violations;
  if (found.length === 0) {
    console.log(`${screen.name}: ok`);
  } else {
    violations += found.length;
    console.log(`${screen.name}: ${found.length} problemi`);
    for (const one of found) {
      console.log(`  [${one.impact}] ${one.id} — ${one.help}`);
      for (const node of one.nodes.slice(0, 3)) {
        console.log(`      ${node.html.slice(0, 120)}`);
      }
    }
  }

  await page.close();
}

await browser.close();
console.log(violations === 0 ? "\nNessuna violazione." : `\n${violations} violazioni.`);
process.exit(violations === 0 ? 0 : 1);
