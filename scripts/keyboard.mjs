/**
 * Le cose che axe non può controllare: la tastiera e le dimensioni dei
 * bersagli.
 *
 *   npm run dev
 *   node scripts/keyboard.mjs
 *
 * Non è una prova di usabilità — quella la fa una persona — ma verifica i tre
 * requisiti verificabili: si arriva su tutto col Tab, il fuoco si vede, e
 * niente su cui si deve toccare è più piccolo di 44 pixel.
 */
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
});

let problems = 0;
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page
  .goto(`${baseUrl}/anteprima`, { waitUntil: "domcontentloaded" })
  .catch(() => {});
await page.waitForTimeout(3500);

// --- 1. Il fuoco si vede ---------------------------------------------------
await page.keyboard.press("Tab");
const focusRing = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const style = getComputedStyle(el);
  return {
    tag: el.tagName,
    label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40),
    outline: style.outlineWidth,
    shadow: style.boxShadow,
  };
});
const visible =
  focusRing &&
  (parseFloat(focusRing.outline) > 0 || focusRing.shadow !== "none");
console.log(
  `fuoco visibile sul primo elemento: ${visible ? "sì" : "NO"} (${focusRing?.label ?? "nessun elemento"})`,
);
if (!visible) problems += 1;

// --- 2. Si arriva ai comandi principali col Tab ----------------------------
const reachable = new Set();
for (let i = 0; i < 60; i += 1) {
  const label = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 40) ?? "";
  });
  if (label) reachable.add(label);
  await page.keyboard.press("Tab");
}

const mustReach = [
  /Cerca|Comandi/i,
  /Impostazioni/i,
  /Cosa c'è da fare|Cosa ti è appena venuto/i,
  /Interpreta con l'AI/i,
];
for (const pattern of mustReach) {
  const found = [...reachable].some((label) => pattern.test(label));
  console.log(`raggiungibile col Tab ${pattern}: ${found ? "sì" : "NO"}`);
  if (!found) problems += 1;
}

// --- 3. Bersagli tattili ---------------------------------------------------
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);

const measured = await page.evaluate(() => {
  const out = [];
  const nodes = document.querySelectorAll(
    'button, a[href], [role="button"], input[type="checkbox"], select',
  );

  for (const node of nodes) {
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue; // nascosto

    // L'area estesa può arrivare da uno ::after: si misura anche quella.
    const after = getComputedStyle(node, "::after");
    const grownY =
      after.content !== "none" && after.position === "absolute"
        ? Math.abs(parseFloat(after.top) || 0) * 2
        : 0;

    const height = box.height + grownY;
    const width = box.width + grownY;
    if (height < 44 || width < 44) {
      out.push({
        label:
          node.getAttribute("aria-label") ??
          node.textContent?.trim().slice(0, 30) ??
          node.tagName,
        w: Math.round(width),
        h: Math.round(height),
        // Dentro un blocco del calendario l'altezza è proporzionale alla
        // durata: un blocco da mezz'ora *è* alto poco.
        inBlock: Boolean(node.closest("[data-blocco]")),
      });
    }
  }
  return out;
});

/*
 * I comandi dentro i blocchi del calendario sono un'eccezione dichiarata, non
 * una dimenticanza. Portarli a 44px coprirebbe il blocco che dovrebbero
 * comandare — a zoom 60 un blocco da 30 minuti è alto 34px — e la stessa
 * azione esiste a dimensione piena nel pannello del task: «Fatto», «Avvia
 * focus», «Sposta a…». È il caso previsto da WCAG 2.2 §2.5.8, che chiede 24px
 * e ammette il controllo equivalente altrove; qui il minimo resta verificato.
 */
const exceptions = measured.filter((one) => one.inBlock);
const small = measured.filter((one) => !one.inBlock);

const tooSmall = exceptions.filter((one) => one.w < 24 || one.h < 24);
if (exceptions.length > 0) {
  console.log(
    `comandi nei blocchi (eccezione dichiarata, minimo 24px): ${exceptions.length}, sotto i 24px: ${tooSmall.length}`,
  );
}
if (tooSmall.length > 0) problems += 1;

if (small.length === 0) {
  console.log("bersagli tattili: tutti ≥44px");
} else {
  console.log(`bersagli tattili sotto i 44px: ${small.length}`);
  for (const one of small.slice(0, 12)) {
    console.log(`  ${one.w}×${one.h} — ${one.label}`);
  }
  problems += 1;
}

await browser.close();
console.log(problems === 0 ? "\nTutto a posto." : `\n${problems} problemi.`);
process.exit(problems === 0 ? 0 : 1);
