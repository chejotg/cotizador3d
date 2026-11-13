// Prueba de sincronización POS ↔ cotización: cambia nombre/precio de COT-015 en DB,
// captura el POS y verifica que la tarjeta muestre los valores NUEVOS (luego el caller revierte).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;

const runSql = (sql) => {
  const f = path.join(".", `tmp-sync-${Date.now()}.sql`);
  fs.writeFileSync(f, sql);
  const out = execFileSync("node", ["run-sql.mjs", f], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL },
  });
  fs.unlinkSync(f);
  return out;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/#/pos`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1600);
}
await page.goto(`${BASE}/#/pos`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1400);

const antes = await page.evaluate(() => {
  const card = Array.from(document.querySelectorAll(".pos-prod-btn")).find((b) =>
    b.textContent.includes("COT-015")
  );
  return card?.textContent.replace(/\s+/g, " ").trim() ?? null;
});
console.log("ANTES (estado actual en DB):", antes);

// mutación temporal
runSql(
  "update cotizacion set producto = 'Espada Sync Test', precio_venta_final = 350 where folio = 'COT-015';"
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const despues = await page.evaluate(() => {
  const card = Array.from(document.querySelectorAll(".pos-prod-btn")).find((b) =>
    b.textContent.includes("COT-015")
  );
  return card?.textContent.replace(/\s+/g, " ").trim() ?? null;
});
console.log("DESPUÉS (debe traer nombre/precio nuevos):", despues);

// reversión
runSql(
  "update cotizacion set producto = 'Espada Maestra', precio_venta_final = 280.60 where folio = 'COT-015';"
);
const revertido = await page.evaluate(() => {
  const card = Array.from(document.querySelectorAll(".pos-prod-btn")).find((b) =>
    b.textContent.includes("COT-015")
  );
  return card?.textContent.replace(/\s+/g, " ").trim() ?? null;
});
console.log("REVERTIDO:", revertido);
await browser.close();
