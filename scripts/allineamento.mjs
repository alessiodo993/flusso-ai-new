/**
 * Allineamento verticale dei controlli nelle righe di lista.
 *
 *   npm run dev                    # in un terminale
 *   node scripts/allineamento.mjs  # in un altro
 *
 * Esiste per un difetto vero: l'allineamento del quadratino di completamento
 * era un `margin-top` scritto a mano, e quando la scala tipografica è cresciuta
 * il quadratino è rimasto quattro pixel più in basso del titolo. Non l'ha visto
 * nessun test — non è un errore, è un numero che non torna più — e nessun
 * controllo di accessibilità, perché non viola niente. Si vede soltanto
 * guardando, o misurando.
 *
 * La regola verificata: ogni controllo accanto a un titolo si centra sulla
 * **prima riga** del titolo, non sul blocco. Con un titolo su tre righe la
 * differenza è di venti pixel.
 */
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
/* Mezzo pixel: sotto quella soglia è arrotondamento del layout, non disallineamento. */
const TOLERANCE = 0.5;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { executablePath: "/opt/pw-browsers/chromium" },
);

let problems = 0;

for (const [name, width] of [
  ["desktop", 1440],
  ["telefono", 390],
]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${baseUrl}/anteprima`, { waitUntil: "domcontentloaded" });
  // In sviluppo il primo carico compila: l'idratazione arriva dopo il DOM.
  await page.waitForTimeout(3200);

  if (width < 1080) {
    await page
      .getByRole("button", { name: "Lista", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(600);
  }

  const rows = await page.evaluate(() => {
    const out = [];
    for (const li of document.querySelectorAll("li")) {
      const checkbox = li.querySelector('input[type="checkbox"]');
      const title = li.querySelector("div > button[type='button']");
      if (!checkbox || !title) continue;

      const t = title.getBoundingClientRect();
      /*
       * `line-height` e non l'altezza dell'elemento: con un titolo su due
       * righe l'altezza raddoppia, ma il riferimento resta la prima riga.
       */
      const lh = parseFloat(getComputedStyle(title).lineHeight);
      const lineCentre = t.top + lh / 2;

      const centreOf = (el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      };

      const parts = { quadratino: checkbox };
      const grip = li.querySelector("button[aria-label^='Trascina']");
      const action = li.querySelector("button[aria-label^='Pianifica']");
      if (grip) parts.maniglia = grip;
      if (action) parts.azioni = action;

      out.push({
        title: title.textContent.trim().slice(0, 40),
        lines: Math.round(t.height / lh),
        offsets: Object.fromEntries(
          Object.entries(parts).map(([key, el]) => [
            key,
            +(centreOf(el) - lineCentre).toFixed(2),
          ]),
        ),
      });
    }
    return out;
  });

  if (rows.length === 0) {
    console.log(`${name}: nessuna riga di lista trovata`);
    problems += 1;
    await page.close();
    continue;
  }

  const bad = rows.filter((row) =>
    Object.values(row.offsets).some((v) => Math.abs(v) > TOLERANCE),
  );

  const worst = rows.reduce(
    (max, row) =>
      Math.max(max, ...Object.values(row.offsets).map((v) => Math.abs(v))),
    0,
  );

  const wrapped = rows.filter((row) => row.lines > 1).length;
  console.log(
    `${name}: ${rows.length} righe (${wrapped} con il titolo a capo), scarto massimo ${worst.toFixed(2)}px`,
  );

  for (const row of bad) {
    problems += 1;
    const detail = Object.entries(row.offsets)
      .map(([key, v]) => `${key} ${v > 0 ? "+" : ""}${v}px`)
      .join(", ");
    console.log(`  ✗ «${row.title}» (${row.lines} righe): ${detail}`);
  }

  await page.close();
}

await browser.close();

if (problems > 0) {
  console.log(`\n${problems} problemi.`);
  process.exit(1);
}
console.log("\nControlli allineati sulla prima riga del titolo.");
