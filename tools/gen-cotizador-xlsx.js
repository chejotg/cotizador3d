const ExcelJS = require("exceljs");
const path = require("path");

const wb = new ExcelJS.Workbook();
wb.creator = "COTIZADOR 3D";

const MONEY = '"Q"#,##0.00';
const headerStyle = (ws, cols) => {
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4358" } };
  r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  if (cols) {
    r.height = 34;
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
  }
};

const fillSolid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const bordersAll = (color, weight = "thin") => ({
  top: { style: weight, color: { argb: color } },
  left: { style: weight, color: { argb: color } },
  right: { style: weight, color: { argb: color } },
  bottom: { style: weight, color: { argb: color } },
});

const resina = {
  qg: "Tarifas!$B$2", plaQg: "Tarifas!$B$3", desp: "Tarifas!$B$4",
  mo: "Tarifas!$B$5", margen: "Tarifas!$B$6", iva: "Tarifas!$B$7",
  consB: "Tarifas!$B$8", consT: "Tarifas!$B$9",
  primer: "Tarifas!$B$10", barniz: "Tarifas!$B$11", pinturas: "Tarifas!$B$12",
  st4: "Tarifas!$B$13", st3: "Tarifas!$B$14", c5: "Tarifas!$B$15",
  embP: "Tarifas!$B$16", embM: "Tarifas!$B$17", embG: "Tarifas!$B$18",
};
const tarifasTarifa = (imp) =>
  `IF($F{r}="Saturn 4",${resina.st4},IF($F{r}="Saturn 3",${resina.st3},IF($F{r}="Creator 5",${resina.c5},0)))`;

const maxRow = 500;

// ---------------- Hoja: Cotizaciones (historial) ----------------
const ws = wb.addWorksheet("Cotizaciones");
const cols = [
  ["Folio", "fol", 10], ["Fecha", "fecha", 12], ["Cliente", "cli", 18],
  ["Producto", "prod", 30], ["Tipo", "tipo", 10], ["Impresora", "imp", 13],
  ["Bandejas", "band", 9], ["Gramos", "g", 9], ["Horas impresión", "hImp", 10],
  ["Horas MO", "hMo", 9], ["Horas pintura", "hPint", 9], ["Pintado", "pint", 9],
  ["Embalaje", "emb", 11], ["Factura", "fac", 9], ["Envío (Q)", "env", 11],
  ["Material (Q)", "mat", 12], ["Máquina (Q)", "maq", 11],
  ["Mano de obra (Q)", "mo", 13], ["Consumibles (Q)", "cons", 14],
  ["Acabado (Q)", "acab", 11], ["Embalaje (Q)", "embQ", 11],
  ["Subtotal (Q)", "sub", 12], ["Margen 40% (Q)", "marg", 13],
  ["TOTAL sin IVA (Q)", "tot", 16], ["Con factura (Q)", "facQ", 14],
  ["TOTAL a cobrar (Q)", "cobrar", 16], ["Precio venta final (Q)", "final", 17],
  ["Extra ganado (Q)", "extra", 14], ["Estado", "est", 12],
];
ws.columns = cols.map((c, i) => ({
  header: c[0], key: c[1], width: c[2],
  letter: String.fromCharCode(65 + i),
}));

const f = (template, r) => template.split("{r}").join(r);

for (let r = 2; r <= maxRow; r++) {
  ws.getCell(`A${r}`).value = {
    formula: `IF($D${r}="","","COT-"&TEXT(ROW()-1,"000"))`,
  };
  ws.getCell(`P${r}`).value = { formula: f(`IF($D{r}="","",$H{r}*IF($E{r}="Resina",${resina.qg},${resina.plaQg})*${resina.desp})`, r) };
  ws.getCell(`Q${r}`).value = { formula: f(`IF($D{r}="","",$I{r}*${tarifasTarifa()})`, r) };
  ws.getCell(`R${r}`).value = { formula: f(`IF($D{r}="","",($J{r}+$K{r})*${resina.mo})`, r) };
  ws.getCell(`S${r}`).value = { formula: f(`IF($D{r}="","",IF($E{r}="Resina",$G{r}*${resina.consB}+${resina.consT},0))`, r) };
  ws.getCell(`T${r}`).value = { formula: f(`IF($D{r}="","",IF($L{r}="Sí",${resina.primer}+${resina.barniz}+${resina.pinturas},0))`, r) };
  ws.getCell(`U${r}`).value = { formula: f(`IF($D{r}="","",IF($M{r}="Pequeña",${resina.embP},IF($M{r}="Mediana",${resina.embM},IF($M{r}="Grande",${resina.embG},0))))`, r) };
  ws.getCell(`V${r}`).value = { formula: `IF($D${r}="","",SUM($P${r}:$U${r}))` };
  ws.getCell(`W${r}`).value = { formula: f(`IF($D{r}="","",$V{r}*${resina.margen})`, r) };
  ws.getCell(`X${r}`).value = { formula: f(`IF($D{r}="","",$V{r}+$W{r})`, r) };
  ws.getCell(`Y${r}`).value = { formula: f(`IF($D{r}="","",$X{r}*(1+${resina.iva}))`, r) };
  ws.getCell(`Z${r}`).value = { formula: f(`IF($D{r}="","",IF($N{r}="Sí",$Y{r},$X{r})+IF($O{r}="",0,$O{r}))`, r) };
  ws.getCell(`AA${r}`).value = { formula: f(`IF($D{r}="","",IF($N{r}="Sí",$Y{r},$X{r}))`, r) };
  ws.getCell(`AB${r}`).value = { formula: f(`IF(OR($D{r}="",$AA{r}=""),"",$AA{r}-IF($N{r}="Sí",$Y{r},$X{r}))`, r) };
}

["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "O"].forEach((c) => {
  ws.getColumn(c).numFmt = MONEY;
});
["I", "J", "K"].forEach((c) => (ws.getColumn(c).numFmt = "0.00"));
ws.getColumn("H").numFmt = "0.0";

const datos = [
  // fecha, cliente, producto, tipo, impresora, bandejas, gramos, hImp, hMo, hPint, pintado, embalaje, factura, envio, estado
  ["2026-10-24", "(por definir)", "Figura He-Man 25 cm", "Resina", "Saturn 4", 4, 720, 28, 8, 0, "No", "Grande", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Figura Bowsette 25 cm", "Resina", "Saturn 4", 2, 300, 11, 10, 0, "No", "Grande", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Batman Shogun 17 cm (pintada)", "Resina", "Saturn 4", 2, 260, 17, 8, 0, "Sí", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 10 piezas PLA", "PLA", "Creator 5", 1, 72, 8, 0.5, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Santa (pequeña)", "PLA", "Creator 5", 1, 20.92, 1.75, 0.5, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 Santas", "PLA", "Creator 5", 1, 240, 19, 1.0, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Bandeja japandi", "PLA", "Creator 5", 1, 64, 2.25, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 osos polares", "PLA", "Creator 5", 1, 196, 15.55, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 renos navideños", "PLA", "Creator 5", 1, 198, 16.73, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 galletas de jengibre", "PLA", "Creator 5", 1, 213, 16.18, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 muñecos de nieve", "PLA", "Creator 5", 1, 183, 13.15, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 12 árboles navideños", "PLA", "Creator 5", 1, 277, 16.85, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Lote 4 esferas de nieve", "PLA", "Creator 5", 1, 68, 2, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-24", "(por definir)", "Bowl del Grinch", "PLA", "Creator 5", 1, 150, 6, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-31", "(por definir)", "Espada Maestra", "PLA", "Creator 5", 6, 583, 20, 1.25, 0, "No", "Ninguno", "Sí", 0, "Emitida"],
  ["2026-10-31", "(por definir)", "Nacimiento 12 cm", "PLA", "Creator 5", 1, 125, 8, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-31", "(por definir)", "Nacimiento minimalista 10 cm", "PLA", "Creator 5", 1, 52, 2.1667, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
  ["2026-10-31", "(por definir)", "Fantasma sacando el dedo", "PLA", "Creator 5", 1, 60, 4, 0.25, 0, "No", "Ninguno", "No", 0, "Emitida"],
];

datos.forEach((row, i) => {
  const r = i + 2;
  const keys = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "AC"];
  row.forEach((v, j) => (ws.getCell(`${keys[j]}${r}`).value = v));
});

const dvs = [
  { col: "E", list: '"Resina,PLA"' },
  { col: "F", list: '"Saturn 4,Saturn 3,Creator 5"' },
  { col: "L", list: '"Sí,No"' },
  { col: "M", list: '"Ninguno,Pequeña,Mediana,Grande"' },
  { col: "N", list: '"Sí,No"' },
  { col: "AC", list: '"Emitida,Confirmada,Entregada,Cancelada"' },
];
dvs.forEach(({ col, list }) => {
  for (let r = 2; r <= maxRow; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [list],
    };
  }
});

ws.autoFilter = `A1:AC${maxRow}`;
headerStyle(ws, true);
// Color de columnas calculadas para distinguirlas de las tecleables
["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AB"].forEach((c) => {
  ws.getColumn(c).font = { color: { argb: "FF1F5C99" } };
});

// ---------------- Hoja: Cotizador (calculadora nueva) ----------------
const wc = wb.addWorksheet("Cotizador");
wc.columns = [{ width: 30 }, { width: 26 }, { width: 70 }];
wc.getCell("A1").value = "COTIZADOR nuevo — llena los datos de arriba y abajo se calcula todo";
wc.getCell("A1").font = { bold: true, size: 13 };

const inputs = [
  ["Fecha", ""], ["Cliente", ""], ["Producto", ""], ["Tipo (Resina/PLA)", "PLA"],
  ["Impresora", "Creator 5"], ["Bandejas", 1], ["Horas impresión", null],
  ["Gramos", null], ["Horas mano de obra", 0.25], ["Horas pintura", 0],
  ["Pintado (Sí/No)", "No"], ["Embalaje", "Ninguno"], ["Factura (Sí/No)", "No"],
  ["Envío (costo real Q)", 0],
];
inputs.forEach((it, i) => {
  wc.getCell(`B${3 + i}`).value = it[0];
  wc.getCell(`B${3 + i}`).font = { bold: true };
  if (it[1] !== null) wc.getCell(`C${3 + i}`).value = it[1];
});
wc.getCell("A18").value = "RESULTADOS";
wc.getCell("A18").font = { bold: true, size: 12 };

const cf = [
  ["Material", '=IF($C$5="","",$C$10*IF($C$6="Resina",{qg},{plaQg})*{desp})'],
  ["Máquina", '=IF($C$5="","",$C$9*IF($C$7="Saturn 4",{st4},IF($C$7="Saturn 3",{st3},IF($C$7="Creator 5",{c5},0))))'],
  ["Mano de obra", '=IF($C$5="","",($C$11+$C$12)*{mo})'],
  ["Consumibles", '=IF($C$5="","",IF($C$6="Resina",$C$8*{consB}+{consT},0))'],
  ["Acabado (pintado)", '=IF($C$5="","",IF($C$13="Sí",{primer}+{barniz}+{pinturas},0))'],
  ["Embalaje", '=IF($C$5="","",IF($C$14="Pequeña",{embP},IF($C$14="Mediana",{embM},IF($C$14="Grande",{embG},0))))'],
  ["Subtotal", '=IF($C$5="","",SUM($C$19:$C$24))'],
  ["Margen 40%", '=IF($C$5="","",$C$25*{margen})'],
  ["TOTAL sin IVA", '=IF($C$5="","",$C$25+$C$26)'],
  ["Con factura (IVA)", '=IF($C$5="","",$C$27*(1+{iva}))'],
  ["TOTAL a cobrar (+ envío)", '=IF($C$5="","",IF($C$15="Sí",$C$28,$C$27)+$C$16)'],
  ["Siguiente folio", '=IF($C$5="","","COT-"&TEXT(COUNTA(Cotizaciones!$D$2:$D$500)+1,"000"))'],
];
cf.forEach((it, i) => {
  const label = it[0];
  let tmpl = it[1];
  ["qg", "plaQg", "desp", "st4", "st3", "c5", "mo", "consB", "consT", "primer", "barniz", "pinturas", "embP", "embM", "embG", "margen", "iva"].forEach((k) => {
    tmpl = tmpl.split(`{${k}}`).join(resina[k]);
  });
  wc.getCell(`A${19 + i}`).value = label;
  wc.getCell(`A${19 + i}`).font = { bold: true };
  wc.getCell(`C${19 + i}`).value = { formula: tmpl.replace(/^=/, "") };
});
[19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].forEach((r) => {
  wc.getCell(`C${r}`).numFmt = MONEY;
});
[
  { cell: "C6", list: '"Resina,PLA"' },
  { cell: "C7", list: '"Saturn 4,Saturn 3,Creator 5"' },
  { cell: "C13", list: '"Sí,No"' },
  { cell: "C14", list: '"Ninguno,Pequeña,Mediana,Grande"' },
  { cell: "C15", list: '"Sí,No"' },
].forEach(({ cell, list }) => {
  wc.getCell(cell).dataValidation = { type: "list", allowBlank: true, formulae: [list] };
});

// ---------------- Hoja: Stock ----------------
const wk = wb.addWorksheet("Stock");
wk.columns = [
  { width: 28 }, { width: 12 }, { width: 12 }, { width: 20 },
  { width: 14 }, { width: 12 }, { width: 10 }, { width: 16 },
];
wk.getCell("A1").value = "CONTROL DE STOCK — saldo = stock inicial + entradas − consumo por cotizaciones − salidas manuales";
wk.getCell("A1").font = { bold: true, size: 12 };
["Ítem", "Unidad", "Entradas", "Consumido por cotizaciones", "Salidas manuales", "Stock inicial", "Saldo", "Mínimo", "Alerta"].forEach((h, i) => {
  const c = wk.getCell(3, i + 1); c.value = h;
});
wk.getRow(3).font = { bold: true };
wk.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F4358" } };
wk.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };

const items = [
  ["Resina Sunlu", "g", true], ["PLA", "g", true], ["IPA", "L", false],
  ["FEP/PFA láminas", "u", false], ["Guantes nitrilo", "pares", false],
  ["Primer Vallejo", "latas", false], ["Barniz Vallejo", "latas", false],
  ["Pinturas acrílicas", "figuras eq.", false], ["Espuma SafeFoam", "rollos", false],
  ["Papel burbuja", "rollos", false], ["Stretch film", "rollos", false],
  ["Cinta (tape)", "rollos", false], ["Papel kraft", "rollos", false],
  ["Stickers", "u", false],
];
items.forEach((it, i) => {
  const r = 4 + i;
  wk.getCell(`A${r}`).value = it[0];
  wk.getCell(`B${r}`).value = it[1];
  if (it[2]) {
    wk.getCell(`D${r}`).value = {
      formula: `SUMIFS(Cotizaciones!$H$2:$H$${maxRow},Cotizaciones!$E$2:$E$${maxRow},"${it[0] === "Resina Sunlu" ? "Resina" : "PLA"}")`,
    };
  }
  wk.getCell(`G${r}`).value = { formula: `$C${r}-IF($D${r}="",0,$D${r})-IF($E${r}="",0,$E${r})+IF($F${r}="",0,$F${r})` };
  wk.getCell(`I${r}`).value = { formula: `IF(AND($H${r}<>"",$G${r}<=$H${r}),"REPOSICION","ok")` };
});

// Movimientos log + consumo por cotización
const consumoRow0 = 4 + items.length + 2; // 19: título del bloque de consumo
const movT = consumoRow0 + 230 + 3; // título MOVIMIENTOS
const movHeaderRow = movT + 1;
const movStart = movT + 2;
wk.getCell(`A${consumoRow0}`).value = "CONSUMO POR COTIZACIÓN (lo que cada cotización descuenta del stock)";
wk.getCell(`A${consumoRow0}`).font = { bold: true, size: 12 };
["Folio", "Producto", "Resina (g)", "PLA (g)", "IPA lavados", "FEP provisión (láminas)", "Guantes (pares)"].forEach((h, i) => {
  const c = wk.getCell(consumoRow0 + 1, i + 1); c.value = h;
});
wk.getRow(consumoRow0 + 1).font = { bold: true, color: { argb: "FFFFFFFF" } };
wk.getRow(consumoRow0 + 1).fill = fillSolid("FF2F4358");
for (let r = consumoRow0 + 2; r < consumoRow0 + 2 + 230; r++) {
  const cq = r - 19; // fila 2..231 de Cotizaciones
  wk.getCell(`A${r}`).value = { formula: `IF(Cotizaciones!$A${cq}="","",Cotizaciones!$A${cq})` };
  wk.getCell(`B${r}`).value = { formula: `IF($A${r}="","",Cotizaciones!$D${cq})` };
  wk.getCell(`C${r}`).value = { formula: `IF($A${r}="","",IF(Cotizaciones!$E${cq}="Resina",Cotizaciones!$H${cq},0))` };
  wk.getCell(`D${r}`).value = { formula: `IF($A${r}="","",IF(Cotizaciones!$E${cq}="PLA",Cotizaciones!$H${cq},0))` };
  wk.getCell(`E${r}`).value = { formula: `IF($A${r}="","",IF(Cotizaciones!$E${cq}="Resina",Cotizaciones!$G${cq},0))` };
  wk.getCell(`F${r}`).value = { formula: `IF($A${r}="","",IF(Cotizaciones!$E${cq}="Resina",Cotizaciones!$G${cq}/40,0))` };
  wk.getCell(`G${r}`).value = { formula: `IF($A${r}="","",IF(Cotizaciones!$E${cq}="Resina",Cotizaciones!$G${cq}+1,0))` };
}
["E", "F", "G"].forEach((col) => (wk.getColumn(col).numFmt = "0.00"));
wk.getColumn("F").numFmt = "0.000";

wk.getCell(`A${movT}`).value = "MOVIMIENTOS (fecha, ítem, entrada, salida, nota)";
wk.getCell(`A${movT}`).font = { bold: true, size: 12 };
["Fecha", "Ítem", "Entrada", "Salida", "Nota"].forEach((h, i) => {
  const c = wk.getCell(movHeaderRow, i + 1); c.value = h;
});
wk.getRow(movHeaderRow).font = { bold: true };
items.forEach((_, i) => {
  const r = 4 + i;
  wk.getCell(`C${r}`).value = { formula: `SUMIFS($C$${movStart}:$C$${movStart + 199},$B$${movStart}:$B$${movStart + 199},$A${r})` };
  wk.getCell(`E${r}`).value = { formula: `SUMIFS($D$${movStart}:$D$${movStart + 199},$B$${movStart}:$B$${movStart + 199},$A${r})` };
});
wk.addConditionalFormatting({
  ref: `I4:I${3 + items.length}`,
  rules: [{
    type: "cellIs", operator: "equal", formulae: ['"REPOSICION"'],
    style: { fill: fillSolid("FFFFC7CE"), font: { color: { argb: "FF9C0006" }, bold: true } },
  }],
});
wk.addConditionalFormatting({
  ref: `A${consumoRow0 + 2}:G${consumoRow0 + 231}`,
  rules: [{ type: "expression", formulae: ["AND($A1<>\"\",MOD(ROW(),2)=0)"], style: { fill: fillSolid("FFE8F5E9") } }],
});

const pvProductos = [
  ["Espada Maestra", 280.6, "COT-015"],
  ["Nacimiento 12 cm", 72.45, "COT-016"],
  ["Nacimiento minimalista 10 cm", 31.81, "COT-017"],
  ["Fantasma sacando el dedo", 40.43, "COT-018"],
  ["Lote 12 Santas", 172.23, "COT-006"],
  ["Lote 12 osos polares", 118.64, "COT-008"],
  ["Lote 12 renos navideños", 123.31, "COT-009"],
  ["Lote 12 galletas de jengibre", 125.4, "COT-010"],
  ["Lote 12 muñecos de nieve", 106.5, "COT-011"],
  ["Lote 12 árboles navideños", 145.56, "COT-012"],
  ["Bandeja japandi", 35.42, "COT-007"],
  ["Bowl del Grinch", 72.38, "COT-014"],
  ["Santa (pequeña)", 31.53, "COT-005"],
  ["Lote 10 piezas PLA", 67.56, "COT-004"],
];
// ---------------- Hoja: Inventario (piezas terminadas) ----------------
const wi = wb.addWorksheet("Inventario");
wi.columns = [
  { width: 30 }, { width: 18 }, { width: 16 }, { width: 16 },
  { width: 12 }, { width: 10 }, { width: 9 }, { width: 14 },
];
wi.mergeCells("A1:H1");
wi.getCell("A1").value = "INVENTARIO DE PIEZAS — saldo = producción + entradas − ventas − salidas manuales";
wi.getCell("A1").fill = fillSolid("FF00BCD4");
wi.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
wi.getRow(1).height = 22;
["Producto", "Producción (entradas)", "Vendidas (auto)", "Salidas manuales", "Stock inicial", "Saldo", "Mínimo", "Alerta"].forEach((h, i) => {
  const c = wi.getCell(3, i + 1); c.value = h;
});
wi.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
wi.getRow(3).fill = fillSolid("FF2F4358");
const invRow0 = 4;
const invRows = 45;
const prodT = invRow0 + invRows + 1; // 50: título
const prodHeaderRow = prodT + 1;
const prodStart = prodT + 2;
for (let i = 0; i < invRows; i++) {
  const r = invRow0 + i;
  if (i < pvProductos.length) wi.getCell(`A${r}`).value = pvProductos[i][0];
  wi.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ["='Punto de venta'!$A$5:$A$44"] };
  wi.getCell(`B${r}`).value = { formula: `SUMIFS($C$${prodStart}:$C$${prodStart + 199},$B$${prodStart}:$B$${prodStart + 199},$A${r})` };
  wi.getCell(`C${r}`).value = { formula: `IF($A${r}="","",SUMIFS(Ventas!$E$2:$E$500,Ventas!$D$2:$D$500,$A${r}))` };
  wi.getCell(`F${r}`).value = { formula: `IF($A${r}="","",$B${r}-IF($C${r}="",0,$C${r})-IF($D${r}="",0,$D${r})+IF($E${r}="",0,$E${r}))` };
  wi.getCell(`H${r}`).value = { formula: `IF(AND($A${r}<>"",$G${r}<>"",$F${r}<=$G${r}),"REPOSICION","ok")` };
}
// Producción log (const ya definidas arriba)
wi.getCell(`A${prodT}`).value = "PRODUCCIÓN / ENTRADAS (fecha, producto, piezas)";
wi.getCell(`A${prodT}`).fill = fillSolid("FF00BCD4");
wi.getCell(`A${prodT}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
["Fecha", "Producto", "Piezas"].forEach((h, i) => {
  const c = wi.getCell(prodHeaderRow, i + 1); c.value = h;
});
wi.getRow(prodHeaderRow).font = { bold: true, color: { argb: "FFFFFFFF" } };
wi.getRow(prodHeaderRow).fill = fillSolid("FF2F4358");
for (let i = 0; i < 200; i++) {
  const r = prodStart + i;
  wi.getCell(`B${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ["='Punto de venta'!$A$5:$A$44"] };
}
wi.addConditionalFormatting({
  ref: `H${invRow0}:H${invRow0 + invRows - 1}`,
  rules: [{
    type: "cellIs", operator: "equal", formulae: ['"REPOSICION"'],
    style: { fill: fillSolid("FFFFC7CE"), font: { color: { argb: "FF9C0006" }, bold: true } },
  }],
});
wi.addConditionalFormatting({
  ref: `F${invRow0}:F${invRow0 + invRows - 1}`,
  rules: [{
    type: "cellIs", operator: "lessThan", formulae: ["0"],
    style: { fill: fillSolid("FFFFC7CE"), font: { color: { argb: "FF9C0006" }, bold: true } },
  }],
});
wi.addConditionalFormatting({
  ref: `A${invRow0}:H${invRow0 + invRows - 1}`,
  rules: [{ type: "expression", formulae: ["AND($A1<>\"\",MOD(ROW(),2)=0)"], style: { fill: fillSolid("FFE0F7FA") } }],
});
for (let r = invRow0; r < invRow0 + invRows; r++) {
  wi.getCell(`E${r}`).fill = fillSolid("FFFFF9C4");
  wi.getCell(`D${r}`).fill = fillSolid("FFFFF9C4");
  wi.getCell(`G${r}`).fill = fillSolid("FFFFF9C4");
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    wi.getCell(`${col}${r}`).border = bordersAll("FFB0BEC5");
  }
}

// ---------------- Hoja: Punto de venta ----------------
const wp = wb.addWorksheet("Punto de venta");
wp.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 24 }];
wp.mergeCells("A1:D1");
wp.getCell("A1").value = "PUNTO DE VENTA";
wp.getCell("A1").fill = fillSolid("FFD81B60");
wp.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
wp.getRow(1).height = 24;

wp.getCell("A3").value = "PRODUCTOS (lista de venta); ajusta precios cuando quieras";
wp.getCell("A3").fill = fillSolid("FF1565C0");
wp.getCell("A3").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
["Producto", "Precio sin factura", "Precio con factura", "Nota / COT ref."].forEach((h, i) => {
  const c = wp.getCell(4, i + 1); c.value = h;
});
wp.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
wp.getRow(4).fill = fillSolid("FF2F4358");

pvProductos.forEach((p, i) => {
  const r = 5 + i;
  wp.getCell(`A${r}`).value = p[0];
  wp.getCell(`B${r}`).value = p[1];
  wp.getCell(`C${r}`).value = { formula: `$B${r}*(1+Tarifas!$B$7)` };
  wp.getCell(`D${r}`).value = p[2];
  wp.getCell(`B${r}`).numFmt = MONEY;
  wp.getCell(`C${r}`).numFmt = MONEY;
  wp.getCell(`B${r}`).fill = fillSolid("FFFFF9C4");
  wp.getCell(`B${r}`).border = bordersAll("FFC9B458");
});
wp.addConditionalFormatting({
  ref: "A5:D44",
  rules: [{ type: "expression", formulae: ['AND($A1<>"",MOD(ROW(),2)=0)'], style: { fill: fillSolid("FFFDE9EC") } }],
});

// Nueva venta
wp.getCell("A47").value = "NUEVA VENTA";
wp.getCell("A47").fill = fillSolid("FF2E7D32");
wp.getCell("A47").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
const ventaInputs = [
  ["Fecha", { formula: "TODAY()" }],
  ["Cliente", ""],
  ["Producto", null],
  ["Cantidad", 1],
  ["Precio unitario sin IVA (auto, editable)", null],
  ["Factura (Sí/No)", "No"],
];
ventaInputs.forEach((it, i) => {
  const r = 49 + i;
  wp.getCell(`B${r}`).value = it[0];
  wp.getCell(`B${r}`).font = { bold: true };
  if (it[1] !== null) wp.getCell(`C${r}`).value = it[1];
  if (i !== 4) {
    wp.getCell(`C${r}`).fill = fillSolid("FFFFF9C4");
    wp.getCell(`C${r}`).border = bordersAll("FFC9B458");
  }
});
wp.getCell("C53").value = { formula: 'IF($C$51="","",IFERROR(INDEX($B$5:$B$44,MATCH($C$51,$A$5:$A$44,0)),""))' };
// orden real: C48 fecha? labels empiezan en B49: fecha C49, cliente C50, producto C51, cant C52, precio C53, factura C54
[["B55", "Subtotal"], ["B56", "IVA 12% (si factura)"], ["B57", "TOTAL"]].forEach(([c, label], i) => {
  wp.getCell(c).value = label;
  wp.getCell(c).font = { bold: true };
});
wp.getCell("C55").value = { formula: 'IF($C$51="","",$C$52*$C$53)' };
wp.getCell("C56").value = { formula: 'IF($C$51="","",IF($C$54="Sí",$C$55*Tarifas!$B$7,0))' };
wp.getCell("C57").value = { formula: 'IF($C$51="","",$C$55+$C$56)' };
[55, 56, 57].forEach((r) => {
  const c = wp.getCell(`C${r}`);
  c.numFmt = MONEY;
  c.fill = fillSolid("FFE8F5E9");
  c.border = bordersAll("FFA5D6A7");
  c.font = { bold: true, color: { argb: "FF1B5E20" } };
});
["C49", "C50", "C51", "C52", "C53", "C54"].forEach((c) => {
  wp.getCell(c).fill = fillSolid("FFFFF9C4");
  wp.getCell("C53").numFmt = MONEY;
});
wp.getCell("C50").dataValidation = { type: "list", allowBlank: true, formulae: ["='Punto de venta'!$A$5:$A$44"] };
wp.getCell("C54").dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };

// Resumen de HOY
wp.getCell("A60").value = "RESUMEN DE VENTAS POR FECHA";
wp.getCell("A60").fill = fillSolid("FF1565C0");
wp.getCell("A60").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
["Fecha", "# ventas", "Total sin factura", "Total con factura", "TOTAL"].forEach((h, i) => {
  const c = wp.getCell(61, i + 1); c.value = h;
});
wp.getRow(61).font = { bold: true, color: { argb: "FFFFFFFF" } };
wp.getRow(61).fill = fillSolid("FF2F4358");
for (let i = 0; i < 70; i++) {
  const r = 62 + i;
  if (i === 0) wp.getCell(`A${r}`).value = { formula: "TODAY()" };
  wp.getCell(`B${r}`).value = { formula: `IF($A${r}="","",COUNTIFS(Ventas!$B$2:$B$500,$A${r}))` };
  wp.getCell(`C${r}`).value = { formula: `IF($A${r}="","",SUMIFS(Ventas!$J$2:$J$500,Ventas!$B$2:$B$500,$A${r},Ventas!$H$2:$H$500,"No"))` };
  wp.getCell(`D${r}`).value = { formula: `IF($A${r}="","",SUMIFS(Ventas!$J$2:$J$500,Ventas!$B$2:$B$500,$A${r},Ventas!$H$2:$H$500,"Sí"))` };
  wp.getCell(`E${r}`).value = { formula: `IF($A${r}="","",$C${r}+$D${r})` };
  ["C", "D", "E"].forEach((col) => (wp.getCell(`${col}${r}`).numFmt = MONEY));
}
wp.addConditionalFormatting({
  ref: "A62:E131",
  rules: [{ type: "expression", formulae: ["AND($A1<>\"\",MOD(ROW(),2)=0)"], style: { fill: fillSolid("FFFDE9EC") } }],
});

// ---------------- Hoja: Ventas ----------------
const wv = wb.addWorksheet("Ventas");
const vCols = [
  ["Nº", 9], ["Fecha", 12], ["Cliente", 18],
  ["Producto", 28], ["Cant", 7], ["Precio u (Q)", 12],
  ["Subtotal (Q)", 12], ["Factura", 9], ["IVA (Q)", 11],
  ["TOTAL (Q)", 13],
];
wv.columns = vCols.map((c) => ({ header: c[0], width: c[1] }));
for (let r = 2; r <= 500; r++) {
  wv.getCell(`A${r}`).value = { formula: `IF($D${r}="","","VT-"&TEXT(ROW()-1,"000"))` };
  wv.getCell(`G${r}`).value = { formula: `IF($D${r}="","",$F${r}*IF($E${r}="",1,$E${r}))` };
  wv.getCell(`I${r}`).value = { formula: `IF($D${r}="","",IF($H${r}="Sí",$G${r}*Tarifas!$B$7,0))` };
  wv.getCell(`J${r}`).value = { formula: `IF($D${r}="","",$G${r}+$I${r})` };
  ["F", "G", "I", "J"].forEach((col) => (wv.getCell(`${col}${r}`).numFmt = MONEY));
  wv.getCell(`H${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };
}
wv.autoFilter = "A1:J500";
headerStyle(wv, true);
wv.addConditionalFormatting({
  ref: "A2:J500",
  rules: [{ type: "expression", formulae: ["MOD(ROW(),2)=0"], style: { fill: fillSolid("FFE0F2F1") } }],
});
// Resumen diario dentro de Ventas (columnas M..Q)
["Fecha", "# ventas", "Total sin factura", "Total con factura", "TOTAL"].forEach((h, i) => {
  const c = wv.getCell(3, 13 + i); c.value = h;
});
wv.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
wv.getRow(3).fill = fillSolid("FF2F4358");
for (let i = 0; i < 100; i++) {
  const r = 4 + i;
  if (i === 0) wv.getCell(`M${r}`).value = { formula: "TODAY()" };
  wv.getCell(`N${r}`).value = { formula: `IF($M${r}="","",COUNTIFS($B$2:$B$500,$M${r}))` };
  wv.getCell(`O${r}`).value = { formula: `IF($M${r}="","",SUMIFS($J$2:$J$500,$B$2:$B$500,$M${r},$H$2:$H$500,"No"))` };
  wv.getCell(`P${r}`).value = { formula: `IF($M${r}="","",SUMIFS($J$2:$J$500,$B$2:$B$500,$M${r},$H$2:$H$500,"Sí"))` };
  wv.getCell(`Q${r}`).value = { formula: `IF($M${r}="","",$O${r}+$P${r})` };
  ["O", "P", "Q"].forEach((col) => (wv.getCell(`${col}${r}`).numFmt = MONEY));
}

// ---------------- Hoja: Tarifas ----------------
const wt = wb.addWorksheet("Tarifas");
wt.columns = [{ width: 40 }, { width: 14 }, { width: 70 }];
headerStyle(wt);
[
  ["Resina Sunlu (Q/g)", 0.27, "Q270 por 1 kg (dueño). Densidad resina 1.1 g/ml"],
  ["PLA (Q/g)", 0.18, "Q180 por 1 kg (dueño, oct 2026)"],
  ["Factor desperdicio", 1.1, "10% por fallos y soportes"],
  ["Mano de obra (Q/h)", 28, "Tarifa única (dueño, oct 2026)"],
  ["Margen", 0.4, "40% sobre subtotal (dueño, oct 2026)"],
  ["IVA", 0.12, "Solo si el cliente pide factura"],
  ["Consumibles MSLA (Q/bandeja)", 5.1, "IPA 2.50 + FEP 1.90 + guantes 0.70 (solo resina)"],
  ["Consumibles (Q/trabajo)", 0.7, "1 par guantes postproceso (solo MSLA)"],
  ["Primer (Q/figura grande)", 23.63, "Vallejo 400 ml, Q189 ÷ 8 figuras"],
  ["Barniz (Q/figura grande)", 15.75, "Vallejo 400 ml, Q189 ÷ 12 figuras"],
  ["Pinturas (Q/figura)", 13, "Prorrateo stock Q1,300"],
  ["Tarifa Saturn 4 (Q/h)", 1.75, "Luz 0.22 + depreciación 1.00 + repuestos 0.10"],
  ["Tarifa Saturn 3 (Q/h)", 1.5, "Luz 0.15 + depreciación 0.92 + repuestos 0.10"],
  ["Tarifa Creator 5 (Q/h)", 2.5, "Luz 1.06 + depreciación 0.81 + repuestos 0.10"],
  ["Embalaje Pequeña (≤5 cm)", 6.61, "Solo con envío o si pide protección"],
  ["Embalaje Mediana (5–15 cm)", 23.93, ""],
  ["Embalaje Grande (>15 cm)", 47.03, ""],
].forEach((row) => wt.addRow(row));
wt.getColumn("B").numFmt = "0.00";
wt.getColumn("B").font = { bold: true, color: { argb: "FF1F5C99" } };

// ---------------- Hoja: Catálogo (mediciones reales) ----------------
const wr = wb.addWorksheet("Catálogo");
wr.columns = [
  { header: "Producto", width: 30 }, { header: "Tipo", width: 10 },
  { header: "Impresora", width: 13 }, { header: "Bandejas", width: 9 },
  { header: "Horas imp.", width: 10 }, { header: "Gramos", width: 9 },
  { header: "Horas MO", width: 9 }, { header: "Pintado", width: 9 },
  { header: "COT ref.", width: 10 },
];
headerStyle(wr, true);
[
  ["Figura He-Man 25 cm", "Resina", "Saturn 4", 4, 28, 720, 8, "No", "COT-001"],
  ["Figura Bowsette 25 cm", "Resina", "Saturn 4", 2, 11, 300, 10, "No", "COT-002"],
  ["Batman Shogun 17 cm", "Resina", "Saturn 4", 2, 17, 260, 8, "Sí", "COT-003"],
  ["Lote 10 piezas PLA", "PLA", "Creator 5", 1, 8, 72, 0.5, "No", "COT-004"],
  ["Santa (pequeña)", "PLA", "Creator 5", 1, 1.75, 20.92, 0.5, "No", "COT-005"],
  ["Lote 12 Santas", "PLA", "Creator 5", 1, 19, 240, 1.0, "No", "COT-006"],
  ["Bandeja japandi", "PLA", "Creator 5", 1, 2.25, 64, 0.25, "No", "COT-007"],
  ["Lote 12 osos polares", "PLA", "Creator 5", 1, 15.55, 196, 0.25, "No", "COT-008"],
  ["Lote 12 renos navideños", "PLA", "Creator 5", 1, 16.73, 198, 0.25, "No", "COT-009"],
  ["Lote 12 galletas de jengibre", "PLA", "Creator 5", 1, 16.18, 213, 0.25, "No", "COT-010"],
  ["Lote 12 muñecos de nieve", "PLA", "Creator 5", 1, 13.15, 183, 0.25, "No", "COT-011"],
  ["Lote 12 árboles navideños", "PLA", "Creator 5", 1, 16.85, 277, 0.25, "No", "COT-012"],
  ["Lote 4 esferas de nieve", "PLA", "Creator 5", 1, 2, 68, 0.25, "No", "COT-013"],
  ["Bowl del Grinch", "PLA", "Creator 5", 1, 6, 150, 0.25, "No", "COT-014"],
  ["Espada Maestra", "PLA", "Creator 5", 6, 20, 583, 1.25, "No", "COT-015"],
  ["Nacimiento 12 cm", "PLA", "Creator 5", 1, 8, 125, 0.25, "No", "COT-016"],
  ["Nacimiento minimalista 10 cm", "PLA", "Creator 5", 1, 2.17, 52, 0.25, "No", "COT-017"],
  ["Fantasma sacando el dedo", "PLA", "Creator 5", 1, 4, 60, 0.25, "No", "COT-018"],
].forEach((r) => wr.addRow(r));

// ---------------- Hoja: LEEME ----------------
const wl = wb.addWorksheet("LEEME");
wl.columns = [{ width: 110 }];
[
  "COTIZADOR 3D — cómo usar este archivo",
  "",
  "1) COTIZAR: llena los campos AMARILLOS de la hoja 'Cotizador' y abajo se calcula todo (material, máquina, mano de obra, margen, IVA, total).",
  "2) GUARDAR: presiona el botón GUARDAR COTIZACIÓN (arriba a la derecha) — la cotización se copia sola a la hoja 'Cotizaciones', se marca como Emitida y los campos se dejan listos para la siguiente.",
  "3) MODIFICAR LUEGO: edita cualquier celda de datos en 'Cotizaciones' y todo se recalcula al instante (nunca edites las columnas en verde).",
  "4) BUSCAR: en la hoja 'Cotizador', panel azul abajo — escribe el folio (p. ej. COT-015) y ves sus datos; abajo puedes fijar el PRECIO DE VENTA FINAL y presionar GUARDAR PRECIO VENTA. También existe el filtro en el encabezado de 'Cotizaciones'.",
  "5) STOCK: hoja 'Stock' — resina y PLA se descuentan solos por las cotizaciones guardadas; el resto se administra en la tabla MOVIMIENTOS (entradas/salidas). Si el saldo baja del mínimo, salta REPOSICION en rojo.",
  "6) EXTRA GANADO: columna 'Extra ganado' en 'Cotizaciones' — verde si ganaste más de lo cotizado, rojo si vendiste por debajo. Edita el 'Estado' con las listas: Confirmada/Entregada se colorean solas.",
  "7) CAMBIAR TARIFAS: edita la hoja 'Tarifas' (celdas amarillas) y TODAS las cotizaciones y el cotizador se recalculan solos.",
  "8) PUNTO DE VENTA: hoja 'Punto de venta' — lista de productos con precio sin/con factura, una venta nueva conectada al catálogo (el precio sale solo y lo puedes pisar) y resumen de ventas por fecha.",
  "9) VENTAS: hoja 'Ventas' — registro completo (el botón REGISTRAR VENTA agrega líneas). El resumen diario (columnas M–Q) suma por fecha; la fila 4 ya apunta a HOY, y escribes cualquier otra fecha abajo. Al guardar una venta, el stock de PLA/resina refleja el consumo cuando la pieza se cotiza en 'Cotizaciones'.",
  "10) STOCK POR COTIZACIÓN: hoja 'Stock', bloque 'CONSUMO POR COTIZACIÓN' — muestra g de resina/PLA, lavados de IPA, provisión de FEP y guantes que descontó cada cotización. En el Cotizador, la sección STOCK RESULTANTE te avisa en rojo si la pieza excede el inventario.",
  "11) INVENTARIO DE PIEZAS: hoja 'Inventario' — saldo de piezas terminadas por producto: entradas por PRODUCCIÓN (tabla de abajo), ventas descontadas AUTOMÁTICAMENTE cuando registras una venta en el punto de venta, y salidas manuales. Alerta REPOSICION en rojo si baja del mínimo.",
  "",
  "Este archivo es .xlsm (tiene macros del botón). Al abrirlo, si Excel pregunta, habilita el contenido. Regenerar base: node tools/gen-cotizador-xlsx.js + powershell tools/instalar-botones.ps1",
].forEach((t, i) => {
  const c = wl.getCell(`A${i + 1}`);
  c.value = t;
  if (i === 0) c.font = { bold: true, size: 14 };
});

// ---------------- Diseño: colores de pestaña ----------------
const tabColors = {
  Cotizaciones: "FF1565C0", Cotizador: "FFF57C00", Stock: "FF2E7D32",
  Tarifas: "FF6A1B9A", "Catálogo": "FF546E7A", LEEME: "FF00897B",
  "Punto de venta": "FFD81B60", Ventas: "FF00695C", Inventario: "FF00838F",
};
Object.entries(tabColors).forEach(([name, color]) => {
  const s = wb.getWorksheet(name);
  if (s) s.properties.tabColor = { argb: color };
});

// ---------------- Diseño: Cotizaciones ----------------
const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC"];
const headerGroups = [["A", "O", "FF2F4358"], ["P", "AB", "FF2E7D32"], ["AC", "AC", "FF6A1B9A"]];
headerGroups.forEach(([from, to, color]) => {
  const start = colLetters.indexOf(from);
  const end = colLetters.indexOf(to);
  for (let i = start; i <= end; i++) {
    const c = ws.getCell(`${colLetters[i]}1`);
    c.fill = fillSolid(color);
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  }
});
// Estados con semáforo
ws.addConditionalFormatting({
  ref: `AC2:AC${maxRow}`,
  rules: [
    { type: "cellIs", operator: "equal", formulae: ['"Confirmada"'], style: { fill: fillSolid("FFC8E6C9"), font: { bold: true, color: { argb: "FF1B5E20" } } } },
    { type: "cellIs", operator: "equal", formulae: ['"Entregada"'], style: { fill: fillSolid("FFBBDEFB"), font: { bold: true, color: { argb: "FF0D47A1" } } } },
    { type: "cellIs", operator: "equal", formulae: ['"Cancelada"'], style: { fill: fillSolid("FFFFC7CE"), font: { bold: true, color: { argb: "FF9C0006" } } } },
  ],
});
// Extra ganado verde/rojo
ws.addConditionalFormatting({
  ref: `AB2:AB${maxRow}`,
  rules: [
    { type: "cellIs", operator: "greaterThan", formulae: ["0"], style: { font: { bold: true, color: { argb: "FF1B5E20" } } } },
    { type: "cellIs", operator: "lessThan", formulae: ["0"], style: { font: { bold: true, color: { argb: "FFB71C1C" } } } },
  ],
});
// Cebra en filas
ws.addConditionalFormatting({
  ref: `A2:AC${maxRow}`,
  rules: [{ type: "expression", formulae: ["MOD(ROW(),2)=0"], style: { fill: fillSolid("FFEAF1F8") } }],
});

// ---------------- Diseño: Cotizador ----------------
wc.mergeCells("A1:C1");
wc.getCell("A1").fill = fillSolid("FFF57C00");
wc.getCell("A1").font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
wc.getRow(1).height = 22;
for (let r = 3; r <= 16; r++) {
  const c = wc.getCell(`C${r}`);
  c.fill = fillSolid("FFFFF9C4");
  c.border = bordersAll("FFC9B458");
  c.font = { bold: true };
}
wc.getCell("A18").fill = fillSolid("FF2F4358");
wc.getCell("A18").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
for (let r = 19; r <= 29; r++) {
  const c = wc.getCell(`C${r}`);
  c.fill = fillSolid("FFE8F5E9");
  c.border = bordersAll("FFA5D6A7");
  c.font = { bold: true, color: { argb: "FF1B5E20" } };
}
wc.getCell("C30").fill = fillSolid("FFEDE7F9");
wc.getCell("C30").font = { bold: true, color: { argb: "FF6A1B9A" } };
wc.getCell("C30").numFmt = "@";
wc.getCell("C30").border = bordersAll("FFA5D6A7");

// ¿Alcanza el stock con esta cotización?
wc.getCell("A31").value = "STOCK RESULTANTE (si imprimes esto)";
wc.getCell("A31").fill = fillSolid("FF2E7D32");
wc.getCell("A31").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
wc.getCell("B32").value = "Stock PLA después (g)";
wc.getCell("C32").value = { formula: 'IF($C$5="","",Stock!$G$5-IF($C$6="PLA",$C$10,0))' };
wc.getCell("B33").value = "Stock resina después (g)";
wc.getCell("C33").value = { formula: 'IF($C$5="","",Stock!$G$4-IF($C$6="Resina",$C$10,0))' };
["B32", "B33"].forEach((c) => (wc.getCell(c).font = { bold: true }));
["C32", "C33"].forEach((c) => wc.getCell(c).numFmt = "0.0");
wc.addConditionalFormatting({
  ref: "C32:C33",
  rules: [{
    type: "cellIs", operator: "lessThan", formulae: ["0"],
    style: { fill: fillSolid("FFFFC7CE"), font: { bold: true, color: { argb: "FF9C0006" } } },
  }],
});

// Panel de búsqueda y precio de venta final
wc.getCell("A35").value = "BUSCAR COTIZACIÓN Y FIJAR PRECIO DE VENTA";
wc.getCell("A35").fill = fillSolid("FF1565C0");
wc.getCell("A35").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
wc.getCell("B36").value = "Folio a buscar (p. ej. COT-015)";
wc.getCell("B36").font = { bold: true };
wc.getCell("C36").fill = fillSolid("FFFFF9C4");
wc.getCell("C36").border = bordersAll("FFC9B458");
wc.getCell("C36").font = { bold: true };
const buscaCol = ["D", "C", "Z", "AA", "AB"];
const buscaLabels = { D: "Producto", C: "Cliente", Z: "TOTAL a cobrar", AA: "Precio venta final", AB: "Extra ganado" };
buscaCol.forEach((col, i) => {
  const r = 37 + i;
  const cell = wc.getCell(`C${r}`);
  cell.value = {
    formula: `IFERROR(INDEX(Cotizaciones!$${col}$2:$${col}$500,MATCH($C$36,Cotizaciones!$A$2:$A$500,0)),"")`,
  };
  if (["Z", "AA", "AB"].includes(col)) cell.numFmt = MONEY;
  cell.fill = fillSolid("FFE8F5E9");
  cell.border = bordersAll("FFA5D6A7");
  wc.getCell(`B${r}`).value = buscaLabels[col];
  wc.getCell(`B${r}`).font = { bold: true };
});
wc.getCell("B42").value = "Nuevo precio de venta final (Q)";
wc.getCell("B42").font = { bold: true };
wc.getCell("C42").fill = fillSolid("FFFFF9C4");
wc.getCell("C42").border = bordersAll("FFC9B458");
wc.getCell("C42").numFmt = MONEY;
wc.getCell("A44").value = "Botones (lado derecho): GUARDAR COTIZACION · GUARDAR PRECIO VENTA · COTIZACIONES · STOCK";
wc.getCell("A44").font = { italic: true, color: { argb: "FF78909C" } };

// ---------------- Diseño: Stock ----------------
wk.getCell("A1").fill = fillSolid("FF2E7D32");
wk.getCell("A1").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
for (let r = 4; r <= 3 + items.length; r++) {
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I"]) {
    wk.getCell(`${col}${r}`).border = bordersAll("FFB0BEC5");
  }
  wk.getCell(`G${r}`).font = { bold: true, color: { argb: "FF1B5E20" } };
  wk.getCell(`I${r}`).font = { bold: true, color: { argb: "FF9C0006" } };
  wk.getCell(`F${r}`).fill = fillSolid("FFFFF9C4");
}
wk.getCell(`A${consumoRow0}`).fill = fillSolid("FF2E7D32");
wk.getCell(`A${consumoRow0}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
wk.getCell(`A${movT}`).fill = fillSolid("FF2E7D32");
wk.getCell(`A${movT}`).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
["A", "B", "C", "D", "E"].forEach((col, i) => {
  const c = wk.getCell(movHeaderRow, i + 1);
  c.font = { bold: true, color: { argb: "FFFFFFFF" } };
  c.fill = fillSolid("FF2F4358");
});
wk.addConditionalFormatting({
  ref: `A${movStart}:E${movStart + 199}`,
  rules: [{ type: "expression", formulae: ["AND($B1<>\"\",MOD(ROW(),2)=0)"], style: { fill: fillSolid("FFE8F5E9") } }],
});

// ---------------- Diseño: Tarifas ----------------
[["A1", "Concepto"], ["B1", "Valor"], ["C1", "Nota"]].forEach(([cell, val]) => {
  wt.getCell(cell).value = val;
});
wt.getRow(1).height = 18;
for (let r = 2; r <= 18; r++) {
  const c = wt.getCell(`B${r}`);
  c.fill = fillSolid("FFFFF9C4");
  c.border = bordersAll("FFC9B458");
  c.font = { bold: true, color: { argb: "FF6A1B9A" } };
  wt.getCell(`A${r}`).border = bordersAll("FFB0BEC5");
  wt.getCell(`C${r}`).border = bordersAll("FFB0BEC5");
}

// ---------------- Diseño: Catálogo ----------------
wr.addConditionalFormatting({
  ref: "A2:I40",
  rules: [{ type: "expression", formulae: ["MOD(ROW(),2)=0"], style: { fill: fillSolid("FFF0F2F4") } }],
});

wb.xlsx
  .writeFile(path.join(__dirname, "..", "datos", "cotizador.xlsx"))
  .then(() => console.log("OK: datos/cotizador.xlsx generado"))
  .catch((e) => { console.error(e); process.exit(1); });

