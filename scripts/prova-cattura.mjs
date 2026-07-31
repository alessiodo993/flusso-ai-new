/**
 * La cattura magica e il planner, provati nel browser vero.
 *
 *   npm run dev                    # in un terminale
 *   node scripts/prova-cattura.mjs # in un altro
 *
 * Il modello non lo chiamiamo: le due route AI sono intercettate e rispondono
 * come risponderebbe lui. Quello che si verifica qui non è la qualità
 * dell'output — per quella c'è `tests/ai-live.test.ts` — ma che l'interfaccia
 * mostri **tutto** ciò che il modello ha prodotto prima di farlo confermare, e
 * che niente vada perso per strada.
 */
import { readFile } from "node:fs/promises";

import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
const axeSource = await readFile(
  new URL("../node_modules/axe-core/axe.min.js", import.meta.url),
  "utf8",
);
const problemi = [];

function verifica(descrizione, condizione, dettaglio = "") {
  if (condizione) {
    console.log(`  ok   ${descrizione}`);
  } else {
    console.log(`  NO   ${descrizione}${dettaglio ? ` — ${dettaglio}` : ""}`);
    problemi.push(descrizione);
  }
}

const RISPOSTA_CATTURA = {
  proposte: [
    {
      id: "crea-0-nuovo",
      action: "crea",
      title: "Organizzare la festa di compleanno di mia sorella",
      taskId: null,
      projectId: null,
      deadline: "2026-08-08",
      estMinutes: 120,
      energy: "media",
      subtasks: [
        "Fare la lista degli invitati",
        "Prenotare il locale",
        "Ordinare la torta",
      ],
      notes: "Sabato sera, siamo una quindicina. Budget circa 300 euro.",
      reason: "«sabato prossimo» è l'8 agosto; stima da una cosa da organizzare.",
    },
    {
      id: "elimina-1-t1",
      action: "elimina",
      title: "Un task che non serve più",
      taskId: "t1",
      projectId: null,
      deadline: null,
      estMinutes: null,
      energy: null,
      subtasks: [],
      notes: "",
      reason: "Hai detto di toglierlo.",
    },
  ],
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.route("**/api/ai/capture", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(RISPOSTA_CATTURA),
  }),
);

await page.goto(`${baseUrl}/anteprima`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// ---------------------------------------------------------------------------
console.log("\nLa bacchetta porta con sé quello che hai già scritto");

const barra = page.getByPlaceholder("Cosa c'è da fare?");
await barra.fill("devo organizzare la festa di mia sorella sabato prossimo");
await page.getByRole("button", { name: "Interpreta con l'AI" }).first().click();
await page.waitForTimeout(600);

const area = page.getByLabel("Cosa hai in testa");
const testoDentro = await area.inputValue();
verifica(
  "il testo entra nella cattura magica",
  testoDentro === "devo organizzare la festa di mia sorella sabato prossimo",
  `trovato «${testoDentro}»`,
);
verifica(
  "la barra resta pulita, senza doppioni",
  (await barra.inputValue()) === "",
);

// ---------------------------------------------------------------------------
console.log("\nLa revisione mostra tutto quello che il modello ha prodotto");

await page.getByRole("button", { name: "Interpreta" }).click();
await page.waitForTimeout(800);

const testo = await page.locator("body").innerText();

verifica(
  "la descrizione si legge prima di salvarla",
  testo.includes("Budget circa 300 euro"),
);
verifica(
  "i sottotask si leggono uno per uno",
  ["Fare la lista degli invitati", "Prenotare il locale", "Ordinare la torta"].every(
    (one) => testo.includes(one),
  ),
);
verifica("la scadenza dedotta si vede", /Scade/.test(testo));
verifica("la stima si vede", testo.includes("2h"));
verifica("il motivo della proposta si vede", testo.includes("è l'8 agosto"));

/*
  Axe qui e non in `a11y.mjs`: questa schermata esiste solo dopo una risposta
  del modello, e quello script non ne finge nessuna. Restava l'unica pagina
  dell'app che nessuno aveva mai controllato.
*/
await page.addScriptTag({ content: axeSource });
const esito = await page.evaluate(() =>
  window.axe.run(document, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  }),
);
verifica(
  "axe non trova violazioni nella revisione",
  esito.violations.length === 0,
  esito.violations.map((one) => `${one.id} (${one.nodes.length})`).join(", "),
);

const applica = page.getByRole("button", { name: /^Applica/ });
verifica(
  "la proposta distruttiva parte rifiutata: si applica solo l'altra",
  (await applica.innerText()).includes("1"),
  await applica.innerText(),
);

await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// ---------------------------------------------------------------------------
console.log("\nIl planner dice perché ha scelto quei task");

// La risposta finta deve parlare di un id che esiste davvero nella demo, o la
// sheet lo scarta prima di arrivare allo schermo — ed è giusto così.
const primoId = "t1";

await page.route("**/api/ai/plan", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      scelte: [
        { taskId: primoId, motivo: "Sblocca il resto del progetto, e scade prima." },
      ],
      nota: "",
    }),
  }),
);

await page.keyboard.press("Meta+k");
await page.waitForTimeout(400);
await page.getByText("Pianifica con AI").click();
await page.waitForTimeout(600);
// Più di un giorno: la giornata di oggi nella demo è già piena, e con «Oggi»
// il task finisce fra quelli che non ci stanno invece che sul calendario.
await page.getByRole("button", { name: "3 giorni" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Trova gli slot" }).click();
await page.waitForTimeout(1200);

const piano = await page.locator("body").innerText();
verifica(
  "il motivo dell'AI compare accanto al blocco",
  piano.includes("Sblocca il resto del progetto"),
  `task ${primoId}`,
);

await browser.close();

console.log(
  problemi.length === 0
    ? "\nTutto a posto."
    : `\n${problemi.length} problemi:\n${problemi.map((one) => `- ${one}`).join("\n")}`,
);
process.exit(problemi.length === 0 ? 0 : 1);
