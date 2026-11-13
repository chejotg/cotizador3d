// Test del fix 'pz': cotizar → guardar → editar → añadir pieza → guardar → confirmar unidades → eliminar
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;

const runSql = (sql) => {
  const f = path.join(".", `tmp-pz2-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL },
  });
  fs.unlinkSync(f);
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errores = [];
page.on("pageerror", (e) => { errores.push(e.message); console.log("PAGEERROR:", e.message); });

// ir al cotizador (login si hace falta)
await page.goto(`${BASE}/#/cotizador`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
}
await page.goto(`${BASE}/#/cotizador`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// 1) crear con desglose de 1 bandeja
await page.locator('input[placeholder="p. ej. Espada Maestra"]').fill("Test pz fix");
await page.locator("table.grid tbody tr").first().locator("input").nth(0).fill("15");
await page.locator("table.grid tbody tr").first().locator("input").nth(1).fill("2");
await page.getByRole("button", { name: /GUARDAR COTIZACIÓN/i }).click();
await page.waitForTimeout(2400);
const folioM = await page.evaluate(
  () => (document.querySelector(".aviso-info")?.textContent || "").match(/COT-\d+/)?.[0]
);
console.log("1) creada:", folioM);
if (!folioM) throw new Error("no se creó la cotización");

// 2) editar → añadir bandeja multi-pieza + pieza → guardar edición
await page.goto(`${BASE}/#/historial`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const fila = page.locator("table.grid tbody tr", { hasText: folioM }).first();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(2200);
console.log("2a) banner:", await page.locator(".aviso-info").first().textContent().catch(() => "(nada)"));
await page.locator('input[type="checkbox"]').first().check();
await page.waitForTimeout(300);
await page.locator('input[placeholder="nombre de la pieza"]').first().fill("Pieza prueba");
await page.getByRole("button", { name: /GUARDAR EDICIÓN/i }).click();
await page.waitForTimeout(2500);

const errVisible = await page.locator(".alerta-roja").first().count();
console.log("2b) guardar edición → error:", errVisible ? await page.locator(".alerta-roja").first().textContent() : "(ninguno) ✅");

// 3) volver a editar: pieza precargada + precio por unidad sugerido
await page.goto(`${BASE}/#/historial`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const fila2 = page.locator("table.grid tbody tr", { hasText: folioM }).first();
await fila2.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(2200);
const estado = await page.evaluate(() => {
  const pieza = Array.from(document.querySelectorAll('input[placeholder="nombre de la pieza"]'))[0]?.value;
  const banner = document.querySelector(".aviso-info")?.textContent || "";
  return { banner: banner.slice(0, 30), pieza };
});
console.log("3) reeditar:", JSON.stringify(estado));

// 4) limpieza: eliminar la cotización (RPC solo se permite sin ventas → vendidas 0)
const limpieza = runSql(`delete from cotizacion where folio = '${folioM}';`);
console.log("4) limpieza:", limpieza.includes("DELETE") ? `${folioM} eliminada ✅` : limpieza);
console.log("pageErrors:", errores.length ? errores : "(ninguno)");
await page.screenshot({ path: path.resolve("../specs/001-cotizador-web/ui-review/pzfix-final.png"), fullPage: true });
await browser.close();

