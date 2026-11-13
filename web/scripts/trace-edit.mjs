// Trace corto: crear → guardar → editar desde historial → observar consola
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[editarFila]") || t.startsWith("[cargarModoEdicion]")) console.log("CONSOLE:", t);
});
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(`${BASE}/#/cotizador`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/cotizador`);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  await page.waitForTimeout(2200);
}
await page.waitForTimeout(1200);

await page.locator('input[placeholder="p. ej. Espada Maestra"]').fill("Test pz trace");
await page.locator("table.grid tbody tr").first().locator("input").nth(0).fill("15");
await page.locator("table.grid tbody tr").first().locator("input").nth(1).fill("2");
await page.getByRole("button", { name: /GUARDAR COTIZACIÓN/i }).click();
await page.waitForTimeout(2400);
console.log("URL tras crear:", page.url());

await page.goto(`${BASE}/#/historial`);
await page.waitForTimeout(1500);
console.log("URL tras goto historial:", page.url());
const fila = page.locator("table.grid tbody tr", { hasText: "Test pz trace" }).first();
await fila.scrollIntoViewIfNeeded();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(2500);
console.log("URL tras editar:", page.url(), "· banner:", await page.locator(".aviso-info").count() ? await page.locator(".aviso-info").first().textContent() : "(nada)");

await browser.close();
