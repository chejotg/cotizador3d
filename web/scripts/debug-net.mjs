import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("response", async (r) => {
  if (r.status() >= 400) {
    let snippet = "";
    try { snippet = (await r.text()).slice(0, 160); } catch {}
    console.log(`HTTP ${r.status()} ${r.request().method()} ${r.url()}\n   ${snippet}`);
  }
});
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const logged = await page.locator("#root .header").count();
if (!logged) {
  await page.getByRole("textbox", { name: /email/i }).fill("crowstoregt@gmail.com");
  await page.locator('input[type="password"]').fill("Chejo,2026$#");
  page.on("response", async (r) => {
    if (r.status() >= 400 && r.url().includes("auth")) console.log(`AUTH ${r.status()} ${r.url()}`);
  });
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForTimeout(1500);
}
for (const tab of ["historial", "inventario", "pos", "tarifas"]) {
  await page.goto(`${BASE}/#/${tab}`);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  await page.waitForTimeout(1300);
}
await browser.close();
console.log("fin");
