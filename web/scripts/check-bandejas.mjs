// Captura el cotizador con el editor de bandejas: 3 bandejas (1 + 2 idénticas) y valida la suma
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1600);
}
await page.goto(`${BASE}/#/cotizador`);
await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
await page.waitForTimeout(1000);

await page.locator('input[placeholder="p. ej. Espada Maestra"]').fill("Prueba 3 bandejas");

// bandeja 1 (fila 1 por defecto)
const row1 = page.locator("table.grid tbody tr").nth(0);
await row1.locator("input").nth(0).fill("100"); // gramos
await row1.locator("input").nth(1).fill("3"); // h imp
await row1.locator("input").nth(2).fill("0.25"); // h mo

// + Agregar bandeja → fila 2: 80 g / 2 h / 0.25 mo, ×2
await page.getByRole("button", { name: /agregar bandeja/i }).click();
const row2 = page.locator("table.grid tbody tr").nth(1);
await row2.locator("input").nth(0).fill("80");
await row2.locator("input").nth(1).fill("2");
await row2.locator("input").nth(2).fill("0.25");
await row2.locator("input").nth(4).fill("2"); // ×N

await page.waitForTimeout(800);
const suma = await page.evaluate(() => {
  const vals = Array.from(
    document.querySelectorAll("input[disabled][readonly], input:read-only")
  ).map((i) => i.value);
  const panel = Array.from(document.querySelectorAll(".calc-fila")).map((f) =>
    f.textContent.replace(/\s+/g, " ").trim()
  );
  return { inputs: vals, filas: panel.slice(0, 12) };
});
console.log(JSON.stringify(suma, null, 2));
await page.screenshot({ path: path.join(OUT, "cotizador-bandejas.png"), fullPage: true });
await browser.close();
