import { describe, it, expect } from "vitest";
import { cotizar, redondeo2, sumarBandejas } from "../src/pricing.js";

// Tarifas reales del negocio (datos/negocio.md, oct 2026) — mismas del seed.sql
const TARIFAS = {
  resina_qg: 0.27,
  pla_qg: 0.18,
  desperdicio: 1.1,
  mo_qh: 28,
  margen: 0.4,
  iva: 0.12,
  cons_bandeja: 5.1,
  cons_trabajo: 0.7,
  primer_qfig: 23.63,
  barniz_qfig: 15.75,
  pinturas_qfig: 13,
  tarifa_saturn4: 1.75,
  tarifa_saturn3: 1.5,
  tarifa_creator5: 2.5,
  embalaje_pequeña: 6.61,
  embalaje_mediana: 23.93,
  embalaje_grande: 47.03,
};

const base = (extra = {}) => ({
  fecha: "2026-10-31",
  cliente: "(por definir)",
  producto: "Test",
  tipo: "PLA",
  impresora: "Creator 5",
  bandejas: 1,
  gramos: 0,
  horas_impresion: 0,
  horas_mo: 0.25,
  horas_pintura: 0,
  pintado: false,
  embalaje: "Ninguno",
  factura: false,
  envio_q: 0,
  ...extra,
});

describe("redondeo2 (half-up, moneda Q)", () => {
  it("redondea 172.428 → 172.43", () => {
    expect(redondeo2(583 * 0.18 * 1.1)).toBeCloseTo(115.43, 2);
  });
  it("redondea 0.005 hacia arriba", () => {
    expect(redondeo2(1.005)).toBe(1.01);
  });
});

describe("casos oro del negocio (Excel + quickstart)", () => {
  it("COT-015 Espada Maestra → Q280.60 sin IVA / Q314.27 con factura", () => {
    const r = cotizar(
      TARIFAS,
      base({
        producto: "Espada Maestra",
        gramos: 583,
        horas_impresion: 20,
        bandejas: 6,
        horas_mo: 1.25,
        factura: true,
      })
    );
    expect(r.material_q).toBeCloseTo(115.43, 2);
    expect(r.maquina_q).toBeCloseTo(50.0, 2);
    expect(r.mano_obra_q).toBeCloseTo(35.0, 2);
    expect(r.consumibles_q).toBe(0);
    expect(r.acabado_q).toBe(0);
    expect(r.embalaje_q).toBe(0);
    expect(r.subtotal_q).toBeCloseTo(200.43, 2);
    expect(r.margen_q).toBeCloseTo(80.17, 2);
    expect(r.total_sin_iva_q).toBeCloseTo(280.6, 2);
    expect(r.con_factura_q).toBeCloseTo(314.27, 2);
    expect(r.total_a_cobrar_q).toBeCloseTo(314.27, 2);
  });

  it("COT-001 He-Man (resina, 4 bandejas, Grande, sin factura) → Q776.96", () => {
    const r = cotizar(
      TARIFAS,
      base({
        producto: "He-Man",
        tipo: "Resina",
        impresora: "Saturn 4",
        bandejas: 4,
        gramos: 720,
        horas_impresion: 28,
        horas_mo: 8,
        embalaje: "Grande",
        factura: false,
      })
    );
    expect(r.material_q).toBeCloseTo(213.84, 2);
    expect(r.maquina_q).toBeCloseTo(49.0, 2);
    expect(r.mano_obra_q).toBeCloseTo(224.0, 2);
    expect(r.consumibles_q).toBeCloseTo(21.1, 2);
    expect(r.embalaje_q).toBeCloseTo(47.03, 2);
    expect(r.subtotal_q).toBeCloseTo(554.97, 2);
    expect(r.margen_q).toBeCloseTo(221.99, 2);
    expect(r.total_sin_iva_q).toBeCloseTo(776.96, 2);
    expect(r.total_a_cobrar_q).toBeCloseTo(776.96, 2);
  });

  it("Ejemplo negocio.md: 50 g resina, 3 h, 1 h MO, 1 bandeja → Q75.46", () => {
    const r = cotizar(
      TARIFAS,
      base({
        producto: "demo",
        tipo: "Resina",
        impresora: "Saturn 4",
        gramos: 50,
        horas_impresion: 3,
        horas_mo: 1,
        factura: false,
      })
    );
    expect(r.material_q).toBeCloseTo(14.85, 2);
    expect(r.maquina_q).toBeCloseTo(5.25, 2);
    expect(r.mano_obra_q).toBeCloseTo(28.0, 2);
    expect(r.consumibles_q).toBeCloseTo(5.8, 2);
    expect(r.subtotal_q).toBeCloseTo(53.9, 2);
    expect(r.total_sin_iva_q).toBeCloseTo(75.46, 2);
  });

  it("COT-016 Nacimiento 12 cm → Q72.45 (con factura Q81.14)", () => {
    const r = cotizar(
      TARIFAS,
      base({
        producto: "Nacimiento",
        gramos: 125,
        horas_impresion: 8,
        horas_mo: 0.25,
      })
    );
    expect(r.material_q).toBeCloseTo(24.75, 2);
    expect(r.maquina_q).toBeCloseTo(20.0, 2);
    expect(r.mano_obra_q).toBeCloseTo(7.0, 2);
    expect(r.subtotal_q).toBeCloseTo(51.75, 2);
    expect(r.margen_q).toBeCloseTo(20.7, 2);
    expect(r.total_sin_iva_q).toBeCloseTo(72.45, 2);
    expect(r.con_factura_q).toBeCloseTo(81.14, 2);
  });

  it("FDM no consume consumibles de resina", () => {
    const r = cotizar(TARIFAS, base({ gramos: 100 }));
    expect(r.consumibles_q).toBe(0);
    expect(r.acabado_q).toBe(0);
  });

  it("Embalaje: Pequeña 6.61 · Mediana 23.93 · Grande 47.03 · Ninguno 0", () => {
    expect(cotizar(TARIFAS, base({ embalaje: "Pequeña" })).embalaje_q).toBeCloseTo(6.61, 2);
    expect(cotizar(TARIFAS, base({ embalaje: "Mediana" })).embalaje_q).toBeCloseTo(23.93, 2);
    expect(cotizar(TARIFAS, base({ embalaje: "Grande" })).embalaje_q).toBeCloseTo(47.03, 2);
    expect(cotizar(TARIFAS, base({ embalaje: "Ninguno" })).embalaje_q).toBe(0);
  });

  it("Pintado agrega minutos de pintura ×28 + acabado 52.38", () => {
    const r = cotizar(
      TARIFAS,
      base({ gramos: 100, horas_pintura: 2, pintado: true, factura: false })
    );
    expect(r.acabado_q).toBeCloseTo(52.38, 2);
    expect(r.mano_obra_q).toBeCloseTo(28 * 2.25, 2);
  });

  it("Envío se suma passthrough al total a cobrar", () => {
    const r = cotizar(
      TARIFAS,
      base({ gramos: 100, factura: true, envio_q: 50 })
    );
    expect(r.total_a_cobrar_q).toBeCloseTo(r.con_factura_q + 50, 2);
  });
});

describe("cobro mínimo (regla 10 negocio.md)", () => {
  it("piso = material + 1 h MO + consumibles, aplica cuando subtotal+margen es menor", () => {
    const r = cotizar(
      TARIFAS,
      base({ gramos: 5, horas_impresion: 0.5, horas_mo: 0, factura: false })
    );
    // material 0.99 · maq 1.25 · mo 0 · cons 0 → sub 2.24 + margen 0.90 = 3.14
    // piso: 0.99 + 28 + 0 = 28.99 → total = 28.99
    expect(r.total_sin_iva_q).toBeCloseTo(28.99, 2);
    expect(r.con_factura_q).toBeCloseTo(32.47, 2);
  });

  it("COT-005 Santa re-cotizada hoy sube al piso (32.14) — histórico se conserva a mano en DB", () => {
    const r = cotizar(
      TARIFAS,
      base({ producto: "Santa", gramos: 20.92, horas_impresion: 1.75, horas_mo: 0.5 })
    );
    expect(r.total_sin_iva_q).toBeCloseTo(32.14, 2);
  });

  it("no aplica cuando el cobro normal ya es mayor", () => {
    const r = cotizar(
      TARIFAS,
      base({ producto: "Espada", gramos: 583, horas_impresion: 20, horas_mo: 1.25 })
    );
    expect(r.total_sin_iva_q).toBeCloseTo(280.6, 2); // no floor trigger
  });
});

describe("precio venta final y extra ganado", () => {
  it("default precio venta = cobro base sin envío", () => {
    const r = cotizar(
      TARIFAS,
      base({ gramos: 583, horas_impresion: 20, horas_mo: 1.25, factura: true })
    );
    expect(r.precio_venta_final_q).toBeCloseTo(314.27, 2);
    expect(r.extra_ganado_q).toBeCloseTo(0, 2);
  });

  it("venta más cara → extra ganado en verde", () => {
    const r = cotizar(
      TARIFAS,
      base({
        gramos: 583,
        horas_impresion: 20,
        horas_mo: 1.25,
        factura: true,
        precio_venta_final: 380,
      })
    );
    expect(r.extra_ganado_q).toBeCloseTo(65.73, 2);
  });

  it("venta más barata → extra negativo", () => {
    const r = cotizar(
      TARIFAS,
      base({ gramos: 125, horas_impresion: 8, precio_venta_final: 50 })
    );
    expect(r.extra_ganado_q).toBeCloseTo(50 - 72.45, 2);
  });
});


describe("sumarBandejas (desglose por bandeja)", () => {
  it("2 repeticiones idénticas duplican gramos/horas/MO/pintura, consumibles ×2", () => {
    const s = sumarBandejas([
      { n: 2, gramos: 291.5, horas_impresion: 10, horas_mo: 0.5, horas_pintura: 0.2 },
    ]);
    expect(s).toEqual({
      bandejas: 2,
      gramos: 583,
      horas_impresion: 20,
      horas_mo: 1,
      horas_pintura: 0.4,
    });
    const r = cotizar(
      TARIFAS,
      base({ ...s, producto: "Espada x2", tipo: "PLA", horas_mo: s.horas_mo })
    );
    // Totales: material/máquina usan la SUMA (la duplicación ya ocurrió en sumarBandejas)
    expect(r.material_q).toBeCloseTo(115.43, 2);   // 583 g totales × 0.18 × 1.10
    expect(r.maquina_q).toBeCloseTo(50.0, 2);      // 20 h totales × 2.50
    expect(r.mano_obra_q).toBeCloseTo(39.2, 2);    // (0.5 h MO + 0.2 h pintura) × 2 repeticiones = 1.4 h
    expect(r.consumibles_q).toBe(0);               // PLA no lleva consumibles
  });

  it("2 bandejas de resina duplican consumibles", () => {
    const s = sumarBandejas([
      { n: 1, gramos: 100, horas_impresion: 3, horas_mo: 0.5, horas_pintura: 0 },
      { n: 1, gramos: 0, horas_impresion: 0, horas_mo: 0, horas_pintura: 0 },
    ]);
    const r = cotizar(
      TARIFAS,
      base({ ...s, producto: "demo", tipo: "Resina", impresora: "Saturn 4" })
    );
    expect(r.consumibles_q).toBeCloseTo(2 * 5.1 + 0.7, 2);
  });

  it("valor inválido en una fila no rompe la suma (n min 1)", () => {
    const s = sumarBandejas([{ n: 0, gramos: -5, horas_impresion: "x", horas_mo: 0.25 }]);
    expect(s).toEqual({
      bandejas: 1,
      gramos: 0,
      horas_impresion: 0,
      horas_mo: 0.25,
      horas_pintura: 0,
    });
  });
});

