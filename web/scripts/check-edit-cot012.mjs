// Valida el flujo: Historial → editar COT-012 → checkbox bandeja, piezas y precio por unidad precargados
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1500);
}

await page.goto(`${BASE}/#/historial`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1500);

const fila = page
  .locator("table.grid tbody tr", { hasText: "COT-012" })
  .first();
await fila.scrollIntoViewIfNeeded();
await fila.locator("button", { hasText: "Editar" }).click();
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const checkbox = document.querySelector('input[type="checkbox"]');
  const inputs = Array.from(document.querySelectorAll("input"));
  const precioUnidad = inputs.find((i) =>
    /precio por unidad/i.test(i.closest("label")?.textContent || "")
  );
  const treeRow = Array.from(document.querySelectorAll("table.grid tbody tr")).find((tr) =>
    /Árbol navideño/i.test(tr.textContent)
  );
  const banner = document.querySelector(".aviso-info")?.textContent || "";
  return {
    banner,
    checkboxMarcado: !!checkbox?.checked,
    precioUnidad: precioUnidad?.value ?? null,
    piezaEnTabla: !!treeRow,
    productos: treeRow ? treeRow.textContent.trim().slice(0, 40) : null,
  };
});
console.log(JSON.stringify(res, null, 2));
await page.screenshot({ path: path.join(OUT, "editar-cot012.png"), fullPage: true });
await browser.close();
