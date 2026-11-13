// E2E: editar COT-039 → cambiar a POR UNIDAD → guardar → verificar sin error
import { chromium } from "playwright";
import path from "node:path";

const BASE = "http://localhost:4173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(`${BASE}/#/historial`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator("input[type=password]").fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/historial`);
  await page.waitForTimeout(1200);
}
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const fila = page.locator("table.grid tbody tr", { hasText: "COT-039" }).first();
await fila.scrollIntoViewIfNeeded();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(2200);

// activar bandeja multi-pieza
const cb = page.locator('input[type="checkbox"]').first();
if (!(await cb.isChecked())) await cb.check();
await page.waitForTimeout(400);

// seleccionar "Se vende POR UNIDAD" (radio button)
const radios = page.locator('input[type="radio"]');
const radioCount = await radios.count();
console.log("radios:", radioCount);
if (radioCount >= 2) {
  await radios.nth(1).check(); // segundo radio = POR UNIDAD
}
await page.waitForTimeout(300);

// nombre de pieza
await page.locator('input[placeholder="nombre de la pieza"]').first().fill("Pieza COT-039");

// guardar edición
await page.getByRole("button", { name: /GUARDAR EDICIÓN/i }).click();
await page.waitForTimeout(2800);

const errVisible = await page.locator(".alerta-roja").first().count();
console.log("error visible:", errVisible ? await page.locator(".alerta-roja").first().textContent() : "(ninguno) ✅");
const aviso = await page.locator(".aviso-info").first().count();
console.log("aviso:", aviso ? (await page.locator(".aviso-info").first().textContent()).slice(0, 80) : "(nada)");
await page.screenshot({ path: path.join(OUT, "pzfix-cot039.png"), fullPage: true });
await browser.close();
