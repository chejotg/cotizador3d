// Verificación final en 4173 (build de producción): login → historial → Editar → precarga desde DB
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:4173";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
// instrumentation
await context.addInitScript(() => {
  window.addEventListener("hashchange", () => console.log("[trace] hashchange →", window.location.hash));
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text().slice(0, 120)));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const email = await page.getByRole("textbox", { name: /email/i }).count();
console.log("vemos login:", email > 0);
if (email) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator("input[type=password]").fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  console.log("login OK (web)");
  await page.goto(`${BASE}/#/historial`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  const fila = page.locator("table.grid tbody tr", { hasText: "COT-019" }).first();
  await fila.scrollIntoViewIfNeeded();
  await fila.locator("button", { hasText: "Editar" }).click();
  await page.waitForTimeout(2800);
  // navegar forzando el hash por JS (aislar navegador vs React)
  await page.evaluate(() => { window.location.hash = "#/cotizador?edit=COT-019"; window.dispatchEvent(new HashChangeEvent("hashchange")); });
  await page.waitForTimeout(3000);
  console.log("[trace] URL tras goto-forzado:", await page.evaluate(() => window.location.hash));
  const prod = await page.locator('input[placeholder="p. ej. Espada Maestra"]').inputValue().catch((e) => `NO-INPUT (${e.message.slice(0, 40)})`);
  console.log("producto tras forzado:", prod);
  await page.screenshot({ path: path.resolve("../specs/001-cotizador-web/ui-review/editar-cot019-4173.png"), fullPage: true });
  await browser.close();
}
