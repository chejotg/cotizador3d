// E2E plantillas de combo: arma combo → 💾 guardar → vender desde COMBOS GUARDADOS → DB checks → limpiar
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;
const OUT = path.resolve(import.meta.dirname, "..", "..", "specs", "001-cotizador-web", "ui-review");

const runSql = (sql) => {
  const f = path.join(".", `tmp-tpl-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL },
    cwd: path.resolve(import.meta.dirname, ".."), // web/
  });
  fs.unlinkSync(f);
  return out;
};
const pick = (t, re) => t.match(re)?.[1] ?? "?";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto(`${BASE}/#/pos`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto(`${BASE}/#/pos`);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  await page.waitForTimeout(1800);
}
await page.waitForTimeout(1000);

// armar combo de 1 pieza COT-012 y guardar como plantilla
const piezasDet = page.locator("details.accordion", { hasText: "VENTA POR UNIDAD" });
const botonCombo = piezasDet.locator("tr", { hasText: "COT-012" }).locator("button", { hasText: "+ combo" }).first();
await botonCombo.scrollIntoViewIfNeeded();
await botonCombo.click();
await page.waitForTimeout(400);
await page.locator("input[placeholder*='Nombre del combo']").fill("Pack Rápido E2E");
await page.locator("button", { hasText: "GUARDAR COMBO (plantilla)" }).click();
await page.waitForTimeout(1800);
const avisoCount = await page.locator(".aviso-info").count();
console.log(
  "1) aviso:",
  avisoCount ? await page.locator(".aviso-info").last().textContent() : "(ninguno)",
  "· alerta:",
  (await page.locator(".alerta-roja").last().count())
    ? await page.locator(".alerta-roja").last().textContent()
    : "(ninguna)"
);
await page.screenshot({ path: path.join(OUT, "tpl-paso1.png"), fullPage: true });

// vender desde COMBOS GUARDADOS
const guardados = page.locator("details.accordion", { hasText: "COMBOS GUARDADOS" });
const card = guardados.locator(".pos-prod-btn", { hasText: "Pack Rápido E2E" });
await card.scrollIntoViewIfNeeded();
await card.locator("button", { hasText: "Vender" }).click();
await page.waitForTimeout(2200);
console.log("2) AVISO vender:", await page.locator(".aviso-info").last().textContent().catch(() => "(nada)"));

// verifica DB: venta registrada + vendidas +1
const dbl = runSql(
  "select (select sum(vendidas) from cotizacion_pieza where folio='COT-012')::text as v, (select folio from venta order by id desc limit 1)::text as folio;"
);
console.log(`3) DB: ${dbl}`);

await page.screenshot({ path: path.join(OUT, "combos-guardados.png"), fullPage: true });

// limpieza: anular venta (devuelve unidades) + eliminar plantilla
const folio = pick(dbl, /(VT-\d{3})/);
fs.writeFileSync("tmp-clean.sql", `update venta set anulada = true where folio = '${folio}';\nupdate cotizacion_pieza pz set vendidas = greatest(pz.vendidas - l.unidades, 0) from venta_combo_linea l where l.pieza_id = pz.id and l.folio_venta = '${folio}';\ndelete from combo_guardado where nombre = 'Pack Rápido E2E';`);
execFileSync("node", ["run-sql.mjs", "tmp-clean.sql"], { encoding: "utf8", env: { ...process.env, DATABASE_URL } });
fs.unlinkSync("tmp-clean.sql");
const fin = runSql(
  "select (select sum(vendidas) from cotizacion_pieza where folio='COT-012')::text as v, (select count(*) from combo_guardado where nombre='Pack Rápido E2E')::text as tpl;"
);
console.log(`4) limpieza: ${fin}`);
await browser.close();



