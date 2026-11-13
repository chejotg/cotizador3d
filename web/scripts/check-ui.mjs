// Revisión UI con Playwright: captura cada pestaña (desktop + móvil) y lista errores de consola.
// Uso: node scripts/check-ui.mjs [baseURL]  (default http://localhost:5173)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:5173";
const OUT = path.resolve("../specs/001-cotizador-web/ui-review");
fs.mkdirSync(OUT, { recursive: true });

const CREDS = { email: "crowstoregt@gmail.com", password: "Chejo,2026$#" };
const TABS = ["cotizador", "historial", "inventario", "pos", "tarifas"];

const browser = await chromium.launch();
const mensajes = [];

async function revisar(t, w, h, etiqueta) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") mensajes.push(`[${etiqueta}] console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => mensajes.push(`[${etiqueta}] pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // login si aparece
  const emailVisible = await page.getByRole("textbox", { name: /email/i }).isVisible().catch(() => false);
  if (emailVisible) {
    await page.getByRole("textbox", { name: /email/i }).fill(CREDS.email);
    await page.locator('input[type="password"]').fill(CREDS.password);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForTimeout(1500);
  }

  for (const tab of TABS) {
    await page.goto(`${BASE}/#/${tab}`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT, `${etiqueta}-${tab}.png`), fullPage: true });
    // scroll completo para lazy renders antes de fullpage
    await page.evaluate(async () => {
      await new Promise((r) => {
        let y = 0;
        const step = () => {
          y += 600;
          window.scrollTo(0, y);
          if (y < document.body.scrollHeight) setTimeout(step, 60);
          else { window.scrollTo(0, 0); setTimeout(r, 200); }
        };
        step();
      });
    });
    await page.screenshot({ path: path.join(OUT, `${etiqueta}-${tab}-full.png`), fullPage: true });
  }

  await ctx.close();
}

await revisar("desk", 1280, 800, "desktop");
await revisar("movil", 390, 844, "movil");

await browser.close();
console.log(" Capturas en", OUT);
console.log("=== ERRORES DE CONSOLA ===");
console.log(mensajes.length ? mensajes.join("\n") : "(ninguno)");
