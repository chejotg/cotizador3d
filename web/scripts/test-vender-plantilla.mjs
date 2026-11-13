// Test puntual: vender la plantilla guardada y verificar DB
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;
const webDir = path.resolve(import.meta.dirname, "..");

const runSql = (sql) => {
  const f = path.join(".", `tmp-v-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL },
    cwd: webDir,
  });
  fs.unlinkSync(f);
  return out;
};

// plantilla garantizada
runSql(
  "insert into combo_guardado (owner_id, nombre, lineas, precio) select id, 'Pack Combo QA', '[{\"cot_folio\":\"COT-012\",\"pieza_id\":null,\"unidades\":1}]'::jsonb, null from auth.users order by created_at limit 1 on conflict do nothing;"
);
// fix: pieza_id real
runSql(
  "update combo_guardado cg set lineas = jsonb_build_array(jsonb_build_object('cot_folio','COT-012','pieza_id',pz.id,'unidades',1)) from cotizacion_pieza pz, auth.users u where cg.nombre='Pack Combo QA' and pz.nombre='Árbol navideño' and pz.folio='COT-012' and pz.owner_id=u.id;"
);

const antes = runSql("select sum(vendidas)::text as v from cotizacion_pieza where folio='COT-012';");
console.log("vendidas ANTES:", antes);

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

const guardados = page.locator("details.accordion", { hasText: "COMBOS GUARDADOS" });
await guardados.locator("summary").click();
await page.waitForTimeout(400);
const card = guardados.locator(".pos-prod-btn", { hasText: "Pack Combo QA" });
const resClick = await page.evaluate(() => {
  const d = [...document.querySelectorAll('details.accordion')].find((x) => x.textContent.includes('COMBOS GUARDADOS'));
  if (!d) return 'sin detalles';
  d.open = true;
  const b = [...d.querySelectorAll('button')].find((x) => x.textContent.includes('Vender'));
  if (!b) return 'sin boton';
  b.click();
  return 'clicked';
});
console.log('click via dom:', resClick);

await page.waitForTimeout(2400);

const ok = await page.locator(".aviso-info").count();
const err = await page.locator(".alerta-roja").last().count();
console.log("aviso:", ok ? await page.locator(".aviso-info").last().textContent() : "(nada)",
  "| alerta:", err ? await page.locator(".alerta-roja").last().textContent() : "(ninguna)");

const despues = runSql(
  "select sum(vendidas)::text as v, (select folio from venta where producto='Pack Combo QA' and not anulada order by id desc limit 1)::text as folio from cotizacion_pieza where folio='COT-012';"
);
console.log("vendidas DESPUÉS:", despues);

// limpieza
runSql(
  "update venta set anulada = true where producto='Pack Combo QA' and not anulada;\nupdate cotizacion_pieza pz set vendidas = greatest(pz.vendidas - l.unidades, 0) from venta_combo_linea l join venta v2 on v2.folio = l.folio_venta where l.pieza_id = pz.id and v2.producto='Pack Combo QA' and v2.anulada = true;\ndelete from combo_guardado where nombre='Pack Combo QA';"
);
console.log("limpieza hecha");
await browser.close();



