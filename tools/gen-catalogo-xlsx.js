const ExcelJS = require("exceljs");

const wb = new ExcelJS.Workbook();
wb.creator = "COTIZADOR 3D";
wb.created = new Date(2026, 9, 4);

const headerStyle = (ws) => {
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4358" } };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
};

// ---- Hoja 1: Productos (catálogo) ----
const ws1 = wb.addWorksheet("Catálogo");
ws1.columns = [
  { header: "Producto", key: "producto", width: 28 },
  { header: "Tipo", key: "tipo", width: 12 },
  { header: "Impresora", key: "impresora", width: 18 },
  { header: "Bandejas", key: "bandejas", width: 10 },
  { header: "Horas impresión", key: "horasImp", width: 15 },
  { header: "Gramos totales", key: "gramos", width: 14 },
  { header: "Horas mano de obra", key: "horasLabor", width: 18 },
  { header: "Pintura", key: "pintura", width: 22 },
  { header: "Embalaje", key: "embalaje", width: 26 },
  { header: "COT ref.", key: "cot", width: 12 },
  { header: "Precio sin pintar (Q)", key: "precioSin", width: 18 },
  { header: "Precio pintado (Q)", key: "precioCon", width: 18 },
];
const productos = [
  ["Figura He-Man 25 cm", "Resina", "Saturn 4", 4, 28, 720, 8, "No", "Grande", "COT-001", 776.96, 891.34],
  ["Figura Bowsette 25 cm", "Resina", "Saturn 4", 2, 11, 300, 10, "No (variante pintada en COT-002)", "Grande", "COT-002", 624.79, 1090.13],
  ["Batman Shogun 17 cm", "Resina", "Saturn 4", 2, 17, 260, 8, "Sí (incluida en las 8 h)", "Grande", "COT-003", null, 551.78],
  ["Lote 10 piezas PLA pequeñas", "PLA", "Creator 5", 1, 8, 72, 0.5, "No", "Opcional", "COT-004", 67.56, null],
  ["Santa (pequeña)", "PLA", "Creator 5", 1, 1.75, 20.92, 0.5, "No", "Opcional", "COT-005", 31.53, null],
  ["Lote 12 Santas (pequeñas)", "PLA", "Creator 5", 1, 19, 240, 1.0, "No", "Opcional", "COT-006", 172.23, null],
  ["Bandeja japandi", "PLA", "Creator 5", 1, 2.25, 64, 0.25, "No", "Opcional", "COT-007", 35.42, null],
  ["Lote 12 osos polares", "PLA", "Creator 5", 1, 15.55, 196, 0.25, "No", "Opcional", "COT-008", 118.64, null],
  ["Lote 12 renos navideños", "PLA", "Creator 5", 1, 16.73, 198, 0.25, "No", "Opcional", "COT-009", 123.31, null],
  ["Lote 12 galletas de jengibre", "PLA", "Creator 5", 1, 16.18, 213, 0.25, "No", "Opcional", "COT-010", 125.4, null],
  ["Lote 12 muñecos de nieve", "PLA", "Creator 5", 1, 13.15, 183, 0.25, "No", "Opcional", "COT-011", 106.5, null],
  ["Lote 12 árboles navideños", "PLA", "Creator 5", 1, 16.85, 277, 0.25, "No", "Opcional", "COT-012", 145.56, null],
  ["Lote 4 esferas de nieve", "PLA", "Creator 5", null, 2, 68, 0.25, "No", "Opcional", "COT-013", 35.65, null],
  ["Bowl del Grinch", "PLA", "Creator 5", 1, 6, 150, 0.25, "No", "Opcional", "COT-014", 72.38, null],
];
productos.forEach((r) => ws1.addRow(r));
ws1.getColumn("precioSin").numFmt = '"Q"#,##0.00';
ws1.getColumn("precioCon").numFmt = '"Q"#,##0.00';
ws1.getColumn("horasImp").numFmt = "0.0";
ws1.getColumn("gramos").numFmt = "0.0";
ws1.getColumn("horasLabor").numFmt = "0.00";
headerStyle(ws1);

// ---- Hoja 2: Equipos ----
const ws2 = wb.addWorksheet("Equipos");
ws2.columns = [
  { header: "Impresora", key: "impresora", width: 22 },
  { header: "Tecnología", key: "tech", width: 14 },
  { header: "Volumen (mm)", key: "vol", width: 24 },
  { header: "Potencia máx. (W)", key: "pot", width: 16 },
  { header: "Costo local real (Q)", key: "costo", width: 18 },
  { header: "Depreciación Q/h", key: "dep", width: 16 },
  { header: "Luz Q/h (EEGSA)", key: "luz", width: 15 },
  { header: "Repuestos Q/h", key: "rep", width: 14 },
  { header: "Costo real Q/h", key: "costoH", width: 15 },
  { header: "TARIFA Q/h", key: "tarifa", width: 14 },
];
[
  ["Elegoo Saturn 4 12K", "MSLA", "218.9 × 122.9 × 220", 144, 2830, 1.0, 0.22, 0.1, 1.32, 1.75],
  ["Elegoo Saturn 3 12K", "MSLA", "218.9 × 122.9 × 250", 144, 1979, 0.92, 0.15, 0.1, 1.17, 1.5],
  ["FlashForge Creator 5", "FDM", "256 × 256 × 256", 700, 8099, 0.81, 1.06, 0.1, 1.97, 2.5],
].forEach((r) => ws2.addRow(r));
["dep", "luz", "rep", "costoH", "tarifa"].forEach((k) => (ws2.getColumn(k).numFmt = '"Q"0.00'));
ws2.getColumn("costo").numFmt = '"Q"#,##0';
headerStyle(ws2);

// ---- Hoja 3: Tarifas y costos ----
const ws3 = wb.addWorksheet("Tarifas y costos");
ws3.columns = [
  { header: "Concepto", key: "c", width: 40 },
  { header: "Valor", key: "v", width: 20 },
  { header: "Nota", key: "n", width: 60 },
];
[
  ["Resina Sunlu transparente", "Q0.27/g", "Q270 por 1 kg (dueño). Densidad asumida 1.1 g/ml para convertir ml→g"],
  ["Factor de desperdicio material", "1.10", "10% por fallos y soportes"],
  ["Filamento PLA", "Q0.18/g", "Q180 por 1 kg (dueño, actualizado oct 2026)"],
  ["Mano de obra", "Q28/h", "Única tarifa para todo tipo de trabajo (dueño, oct 2026)"],
  ["Tarifa máquina Saturn 4", "Q1.75/h", "Luz Q0.22 + depreciación Q1.00 + repuestos Q0.10"],
  ["Tarifa máquina Saturn 3", "Q1.50/h", "Luz Q0.15 + depreciación Q0.92 + repuestos Q0.10"],
  ["Tarifa máquina Creator 5", "Q2.50/h", "Luz Q1.06 (700 W máx) + depreciación Q0.81 (Q8,099 local) + repuestos Q0.10"],
  ["Consumibles MSLA por bandeja", "Q5.10", "IPA Q2.50 + FEP Q1.90 + guantes Q0.70 (solo resina; FDM = Q0)"],
  ["Consumibles por trabajo", "Q0.70", "1 par de guantes post-proceso (solo MSLA)"],
  ["Primer Vallejo 400 ml", "Q23.63/figura grande", "Q189/lata ÷ 8 figuras grandes"],
  ["Barniz Vallejo 400 ml", "Q15.75/figura grande", "Q189/lata ÷ 12 figuras grandes"],
  ["Pinturas (stock Q1,300)", "Q13/figura", "Prorrateo conservador; stock ≥100 figuras y ninguna agotada"],
  ["Embalaje Pequeña (≤5 cm)", "Q6.61", "Solo con envío o si cliente pide protección"],
  ["Embalaje Mediana (5–15 cm)", "Q23.93", "Solo con envío o si cliente pide protección"],
  ["Embalaje Grande (>15 cm)", "Q47.03", "Solo con envío o si cliente pide protección"],
  ["Envío", "por cotización", "Costo real al cliente"],
  ["Margen", "40%", "Sobre el subtotal (dueño, oct 2026)"],
  ["IVA", "12%", "Solo si el cliente pide factura"],
  ["Luz EEGSA", "Q1.51/kWh", "Tarifa no social, vigente 1 ago – 31 oct 2026 (CNEE)"],
].forEach((r) => ws3.addRow(r));
headerStyle(ws3);

// ---- Hoja 4: Cotizaciones emitidas ----
const ws4 = wb.addWorksheet("Cotizaciones");
ws4.columns = [
  { header: "Folio", key: "folio", width: 10 },
  { header: "Fecha", key: "fecha", width: 12 },
  { header: "Producto", key: "prod", width: 28 },
  { header: "Impresora", key: "imp", width: 16 },
  { header: "Subtotal (Q)", key: "sub", width: 13 },
  { header: "TOTAL sin IVA (Q)", key: "total", width: 17 },
  { header: "Con factura (Q)", key: "conIva", width: 15 },
  { header: "Ingreso propio (Q)", key: "ingreso", width: 17 },
  { header: "Estado", key: "estado", width: 14 },
];
[
  ["COT-001", "2026-10-24", "Figura He-Man 25 cm", "Saturn 4", 554.97, 776.96, 870.19, 445.99, "Emitida"],
  ["COT-002", "2026-10-24", "Figura Bowsette 25 cm (pintada)", "Saturn 4", 778.66, 1090.13, 1220.94, 458.51, "Emitida"],
  ["COT-003", "2026-10-24", "Batman Shogun 17 cm (pintada)", "Saturn 4", 394.13, 551.78, null, 381.65, "Emitida"],
  ["COT-004", "2026-10-24", "Lote 10 piezas PLA", "Creator 5", 48.26, 67.56, null, 33.3, "Emitida"],
  ["COT-005", "2026-10-24", "Santa pequeña", "Creator 5", 22.52, 31.53, null, 23.01, "Emitida"],
  ["COT-006", "2026-10-24", "Lote 12 Santas", "Creator 5", 123.02, 172.23, null, 77.21, "Emitida"],
  ["COT-007", "2026-10-24", "Bandeja japandi", "Creator 5", 25.3, 35.42, null, 17.12, "Emitida"],
  ["COT-008", "2026-10-24", "Lote 12 osos polares", "Creator 5", 84.74, 118.64, null, 40.9, "Emitida"],
  ["COT-009", "2026-10-24", "Lote 12 renos navideños", "Creator 5", 88.08, 123.31, null, 42.23, "Emitida"],
  ["COT-010", "2026-10-24", "Lote 12 galletas de jengibre", "Creator 5", 89.57, 125.4, null, 42.83, "Emitida"],
  ["COT-011", "2026-10-24", "Lote 12 muñecos de nieve", "Creator 5", 76.07, 106.5, null, 37.43, "Emitida"],
  ["COT-012", "2026-10-24", "Lote 12 árboles navideños", "Creator 5", 103.97, 145.56, null, 48.59, "Emitida"],
  ["COT-013", "2026-10-24", "Lote 4 esferas de nieve", "Creator 5", 25.46, 35.65, null, 17.12, "Emitida"],
  ["COT-014", "2026-10-24", "Bowl del Grinch", "Creator 5", 51.7, 72.38, null, 27.68, "Emitida"],
].forEach((r) => ws4.addRow(r));
["sub", "total", "conIva", "ingreso"].forEach((k) => (ws4.getColumn(k).numFmt = '"Q"#,##0.00'));
headerStyle(ws4);

wb.xlsx.writeFile("C:\\Users\\sergi\\Downloads\\GITHUB\\COTIZADOR 3D\\datos\\catalogo.xlsx")
  .then(() => console.log("OK: catalogo.xlsx generado"))
  .catch((e) => { console.error(e); process.exit(1); });
