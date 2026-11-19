// Verifica que Reportes recalcule totales al cambiar el rango y que "Todo" restaure los datos.
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:4173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/#/reportes`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1600);
}
await page.goto(`${BASE}/#/reportes`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1400);

const leerTotal = async () =>
  (await page.locator(".stat-card", { hasText: "TOTAL VENDIDO (pagado)" }).first().textContent())
    .replace(/\s+/g, " ")
    .trim();

const leerFilas = async () => await page.locator("table.grid tbody tr").count();

// 1) Modo Todo
const todoTotal = await leerTotal();
const todoFilas = await leerFilas();
console.log("TODO:", todoTotal, "| filas detalle:", todoFilas);

// 2) Rango estrecho (1–10 de noviembre 2026)
await page.getByRole("radio", { name: /rango/i }).check();
await page.locator('input[type="date"]').first().fill("2026-11-01");
await page.locator('input[type="date"]').nth(1).fill("2026-11-10");
await page.waitForTimeout(1200);
const rangoTotal = await leerTotal();
const rangoFilas = await leerFilas();
console.log("RANGO 1–10 nov:", rangoTotal, "| filas detalle:", rangoFilas);

// 3) Volver a Todo: debe restaurar
await page.getByRole("radio", { name: /todo/i }).check();
await page.waitForTimeout(1200);
const vueltaTotal = await leerTotal();
const vueltaFilas = await leerFilas();
console.log("VUELTA TODO:", vueltaTotal, "| filas detalle:", vueltaFilas);

const ok =
  (rangoTotal !== todoTotal || rangoFilas !== todoFilas) &&
  vueltaTotal === todoTotal &&
  vueltaFilas === todoFilas;
console.log(ok ? "✅ PASS: el rango filtra y Todo restaura" : "❌ FAIL");
await browser.close();
process.exit(ok ? 0 : 1);
