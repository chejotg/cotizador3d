// Regresión: editar COT-012, GUARDAR sin cambios → verifica que bandejas/piezas/precio no se rompan
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;
const tmpDir = path.resolve(".");
const q = (sql) => {
  const f = path.join(tmpDir, `tmp-q-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], { encoding: "utf8", env: { ...process.env, DATABASE_URL } });
  fs.unlinkSync(f);
  return out;
};

const antes = q("select precio_venta_unidad, bandejas_detalle is not null as tiene_detalle from cotizacion where folio='COT-012';");
console.log("antes:", antes.match(/"precio_venta_unidad": "?[^,\n}]+|tiene_detalle[^,}]*/g)?.join(" | "));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
let pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1600);
}
await page.goto(`${BASE}/#/historial`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1400);
const fila = page.locator("table.grid tbody tr", { hasText: "COT-012" }).first();
await fila.scrollIntoViewIfNeeded();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(1600);
await page.locator("button", { hasText: /GUARDAR EDIC/i }).click();
await page.waitForTimeout(2500);

const errVisible = await page.locator(".alerta-roja").first().count();
if (errVisible) console.log("ERROR EN PANTALLA:", await page.locator(".alerta-roja").first().textContent());
const ok = await page.locator(".aviso-info").first().count();
if (ok) console.log("AVISO:", await page.locator(".aviso-info").first().textContent());
console.log("pageErrors:", pageErrors.length ? pageErrors : "(ninguno)");
await browser.close();

const despues = q(
  "select precio_venta_unidad, jsonb_typeof(bandejas_detalle) as det_tipo, jsonb_array_length(bandejas_detalle) as det_len, (select vendidas from cotizacion_pieza where folio='COT-012') as vendidas from cotizacion where folio='COT-012';"
);
console.log("después:", despues.match(/"precio_venta_unidad": "?[^,\n}]+|det_tipo[^,}]+|det_[a-z]+": "?"?[0-9null-]+|"vendidas": [0-9]+/g)?.join(" | "));
