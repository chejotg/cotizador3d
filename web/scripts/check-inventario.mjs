import { chromium } from "playwright";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:4173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto(`${BASE}/#/inventario`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator("input[type=password]").fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/inventario`);
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(1400);
const texts = await page.evaluate(() => ({
  stats: Array.from(document.querySelectorAll(".stat-card")).map((c) => c.textContent.replace(/\s+/g, " ").trim()),
  piezas: Array.from(document.querySelectorAll("details.accordion")).map((d) => ({
    Titulo: d.querySelector("summary")?.textContent.slice(0, 50),
    filas: d.querySelectorAll("tbody tr").length,
  })),
  filaArbol: (document.body.textContent.match(/Árbol navideño/) ? "presente" : "ausente"),
}));
console.log(JSON.stringify(texts, null, 2));
await page.screenshot({ path: path.join(OUT, "inventario-unificado.png"), fullPage: true });
await browser.close();
