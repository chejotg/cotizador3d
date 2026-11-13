// E2E: venta con datos de cliente → verificación en la pestaña Pedidos
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:4173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(`${BASE}/#/pos`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator("input[type=password]").fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/pos`);
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(1000);

// venta rápida con cliente
await page.locator('input[placeholder="(mostrador)"]').fill("María López");
const dir = page.locator('input[placeholder="para envíos"]');
await dir.fill("Zona 12, Guatemala");
await page.locator('input[placeholder="p. ej. 5555-1234"]').fill("5012-3456");
// producto: Espada Maestra vía dropdown
await page.locator("select.input-amarillo").first().selectOption({ label: "Espada Maestra" });
await page.getByRole("button", { name: /REGISTRAR VENTA/i }).click();
await page.waitForTimeout(2400);
console.log("venta aviso:", await page.locator(".aviso-info").first().textContent().catch(() => "(nada)"));

// pestaña Pedidos
await page.locator(".tabs button", { hasText: "Pedidos" }).click();
await page.waitForTimeout(1800);
const fila = page.locator("table.grid tbody tr", { hasText: "María López" });
const cnt = await fila.count();
console.log("pedidos con María López:", cnt);
if (cnt) {
  console.log("fila:", (await fila.first().textContent()).replace(/\s+/g, " ").slice(0, 160));
  // cambiar estado a Preparando
  await fila.first().locator("select").first().selectOption("Preparando");
  await page.waitForTimeout(1500);
  console.log("estado cambiado a Preparando ✓");
}
await page.screenshot({ path: path.join(OUT, "pedidos-seguimiento.png"), fullPage: true });
await browser.close();
