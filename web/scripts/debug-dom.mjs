import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const ya = await page.locator("#root .header").count();
if (!ya) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1500);
}
await page.goto(`${BASE}/#/historial`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1500);

const ths = await page.locator("table.grid thead th").count();
const tds = await page.locator("table.grid tbody tr").first().locator("td").count();
const btns = await page.locator("table.grid tbody tr >> nth=0 >> button").count();
const tablaW = await page.locator("table.grid").first().evaluate((t) => ({ sw: t.scrollWidth, cw: t.clientWidth }));
console.log({ ths, tds, btnsPrimerTr: btns, tablaW });

const overflow = await page.evaluate(() =>
  Array.from(document.querySelectorAll("*"))
    .filter((e) => e.scrollWidth > e.clientWidth + 40 && !["HTML", "BODY"].includes(e.tagName))
    .slice(0, 10)
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 40)} sw=${e.scrollWidth} cw=${e.clientWidth}`)
);
console.log("elementos desbordados:", overflow);

await browser.close();
