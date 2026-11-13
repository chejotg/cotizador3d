// E2E combos: armar combo con COT-012 · vender · verificar vendidas · Anular · verificar devolución
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");

const runSql = (sql) => {
  const f = path.join(".", `tmp-qi-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL },
  });
  fs.unlinkSync(f);
  return out;
};
const pick = (text, re) => text.match(re)?.[1] ?? "???";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto(`${BASE}/#/pos`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1700);
  await page.goto(`${BASE}/#/pos`);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
}
await page.waitForTimeout(1200);

const antes = runSql(
  "select sum(vendidas) as v from cotizacion_pieza where folio='COT-012';"
);
console.log("vendidas ANTES:", pick(antes, /"v": "?(\d+)"?/));

// abrir ARMAR COMBO
const detalles = page.locator("details.accordion", { hasText: "ARMAR COMBO" });
if (!(await detalles.getAttribute("open")) && (await detalles.getAttribute("open")) === null) {
  await detalles.locator("summary").click();
}
await detalles.locator("summary").click(); // close
await detalles.locator("summary").click(); // re-open (garantizar)
await page.waitForTimeout(400);

// tocar pieza de COT-012 en la tabla VENTA POR UNIDAD
const piezaBtn = page.locator("details.accordion", { hasText: "VENTA POR UNIDAD" })
  .locator("tr", { hasText: "COT-012" })
  .locator("button", { hasText: "+ combo" })
  .first();
await piezaBtn.scrollIntoViewIfNeeded();
await piezaBtn.click();
await page.waitForTimeout(400);

await detalles.locator("input[placeholder*='Nombre del combo']").fill("Pack Prueba E2E");
await detalles.locator("button", { hasText: "REGISTRAR COMBO" }).click();
await page.waitForTimeout(2200);

const aviso = await page.locator(".aviso-info").first().count();
console.log("AVISO:", aviso ? await page.locator(".aviso-info").first().textContent() : "(sin aviso)");
console.log("ERR:", (await page.locator(".alerta-roja").last().count())
  ? await page.locator(".alerta-roja").last().textContent() : "(sin error visible)");
await page.screenshot({ path: path.join(OUT, "combo-registro.png"), fullPage: true });

const medio = runSql(
  "select (select sum(vendidas) from cotizacion_pieza where folio='COT-012') as vendidas, (select max(folio) from venta) as venta, (select anulada from venta order by id desc limit 1) as anulada;"
);
const vM = pick(medio, /"vendidas": "?(\d+)"?/);
const ventaF = pick(medio, /"venta": "?(VT-\d+)/);
console.log("DESPUÉS: vendidas =", vM, "· venta =", ventaF);

// anular la venta del combo (debe devolver unidades)
const folio = pick(medio, /"venta": "?(VT-\d+)/);
page.on("dialog", (d) => d.accept());
const filaVenta = page.locator("table.grid tr", { hasText: folio });
await filaVenta.scrollIntoViewIfNeeded();
await filaVenta.locator("button", { hasText: "Anular" }).click();
await page.waitForTimeout(2000);

const despues = runSql(
  "select (select sum(vendidas) from cotizacion_pieza where folio='COT-012') as vendidas, (select anulada from venta where folio='" + folio + "') as anulada;"
);
const vDespues = pick(despues, /"vendidas": "?(\d+)"?/);
const aDespues = pick(despues, /"anulada": "?(\w+)/);
console.log("TRAS ANULAR: vendidas =", vDespues, "· anulada =", aDespues);
await browser.close();
