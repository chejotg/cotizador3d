// Reproduce el flujo del usuario: Historial → click Editar en COT-019 → capturar estado del Cotizador
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const BASE = process.argv[2] || "http://localhost:5173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[editarFila]") || t.startsWith("[cargarModoEdicion]")) console.log("CONSOLE:", t.slice(0, 200));
});

await page.goto(`${BASE}/#/historial`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/historial`);
  await page.waitForTimeout(1200);
}
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const fila = await page.locator("table.grid tbody tr", { hasText: "COT-019" }).first();
await fila.scrollIntoViewIfNeeded();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(2600);

const estado = await page.evaluate(() => ({
  hash: location.hash,
  banner: document.querySelector(".aviso-info")?.textContent?.slice(0, 60) || "(sin banner)",
  producto: document.querySelector('input[placeholder="p. ej. Espada Maestra"]')?.value ?? null,
  gramos: document.querySelector('table.grid tbody tr')?.querySelector("input")?.value ?? null,
  ss: sessionStorage.getItem("editCotizacion"),
  botones: document.querySelector('button[type="submit"]')?.textContent,
}));
console.log(JSON.stringify(estado, null, 2));
await page.screenshot({ path: path.join(OUT, "editar-cot019-user.png"), fullPage: true });
await browser.close();
