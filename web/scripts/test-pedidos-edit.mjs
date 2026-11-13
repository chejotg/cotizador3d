// E2E simplificado: editar cliente en Pedidos + crear venta vía SQL + eliminarla por UI
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const BASE = "http://localhost:4173";
const DATABASE_URL = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// 1) crear venta de prueba directa en DB (folio VT-TST con un producto real)
const { rows: prod } = await client.query("select nombre from producto limit 1");
const { rows: vt } = await client.query(
  `insert into venta (owner_id, folio, fecha, cliente, producto, cantidad, precio_unit, factura, subtotal_q, iva_q, total_q)
   select id, 'VT-TST', current_date, 'Cliente Test', $1, 1, 50, false, 50, 0, 50 from auth.users order by created_at limit 1
   returning folio`,
  [prod[0].nombre]
);
const folio = vt[0].folio;
console.log("1) venta de prueba creada:", folio, "· producto:", prod[0].nombre);

// 2) UI: editar cliente + eliminar
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(`${BASE}/#/pedidos`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (!(await page.locator("#root .header").count())) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator("input[type=password]").fill("cotizador2026");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForSelector("#root .header", { timeout: 15000 });
  await page.goto(`${BASE}/#/pedidos`);
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(1400);

const fila = page.locator("table.grid tbody tr", { hasText: "VT-004" }).first();
await fila.scrollIntoViewIfNeeded();
await fila.locator('input[style*="width: 140"]').first().fill("María López (editada)");
await fila.locator('input[style*="width: 140"]').first().blur();
await page.waitForTimeout(1500);
const { rows: chk } = await client.query("select cliente from venta where folio = 'VT-004'");
console.log("2) cliente VT-004 editado a:", chk[0]?.cliente);

const filaT = page.locator("table.grid tbody tr", { hasText: folio }).first();
await filaT.scrollIntoViewIfNeeded();
page.on("dialog", (d) => d.accept());
await filaT.locator("button", { hasText: "eliminar" }).click();
await page.waitForTimeout(2500);
const queda = await page.locator("table.grid tbody tr", { hasText: folio }).count();
const { rows: dbQ } = await client.query("select count(*) as n from venta where folio = $1", [folio]);
console.log("3) tras eliminar:", folio, "· filas UI:", queda, "· en DB:", dbQ[0].n, "(debe ser 0) ✅");
await client.end();
await browser.close();
