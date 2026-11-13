// pricing.js — módulo Puro de cálculo del negocio (sin DOM, sin supabase).
// Fuente de las fórmulas: datos/negocio.md + specs/001-cotizador-web/data-model.md.
// La DB (RPC) es la fuente definitiva al guardar; esto es el preview en vivo del browser
// y se testea con vitest contra los mismos casos oro.

// Redondeo half-up a 2 decimales (paridad con Excel y round(x,2) de Postgres para positivos).
export function redondeo2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const clamp0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * cotizar(tarifas, entrada) → snapshot de componentes
 * @param {object} tarifas  mapa clave→valor de la tabla `tarifa`
 * @param {object} entrada  { fecha, cliente, producto, tipo, impresora, bandejas,
 *                            gramos, horas_impresion, horas_mo, horas_pintura,
 *                            pintado, embalaje, factura, envio_q, precio_venta_final? }
 */
export function cotizar(tarifas, entrada) {
  const t = tarifas || {};
  const g = clamp0(entrada.gramos);
  const hImp = clamp0(entrada.horas_impresion);
  const hMo = clamp0(entrada.horas_mo);
  const hPint = clamp0(entrada.horas_pintura);
  const bandejas = Math.max(1, Math.floor(Number(entrada.bandejas) || 1));
  const envio = redondeo2(clamp0(entrada.envio_q));

  const esResina = entrada.tipo === "Resina";
  const precioG = esResina ? t.resina_qg : t.pla_qg;

  const material_q = redondeo2(g * precioG * t.desperdicio);
  const maqTarifa =
    entrada.impresora === "Saturn 4"
      ? t.tarifa_saturn4
      : entrada.impresora === "Saturn 3"
        ? t.tarifa_saturn3
        : t.tarifa_creator5;
  const maquina_q = redondeo2(hImp * maqTarifa);
  const mano_obra_q = redondeo2((hMo + hPint) * t.mo_qh);
  const consumibles_q = esResina ? redondeo2(bandejas * t.cons_bandeja + t.cons_trabajo) : 0;
  const acabado_q = entrada.pintado ? redondeo2(t.primer_qfig + t.barniz_qfig + t.pinturas_qfig) : 0;
  const embalaje_q =
    entrada.embalaje === "Pequeña"
      ? redondeo2(t.embalaje_pequeña)
      : entrada.embalaje === "Mediana"
        ? redondeo2(t.embalaje_mediana)
        : entrada.embalaje === "Grande"
          ? redondeo2(t.embalaje_grande)
          : 0;

  const subtotal_q = redondeo2(
    material_q + maquina_q + mano_obra_q + consumibles_q + acabado_q + embalaje_q
  );
  const margen_q = redondeo2(subtotal_q * t.margen);

  // Regla 10 del negocio: piso de cobro mínimo — material + 1 h de MO + consumibles
  const cobro_minimo = redondeo2(material_q + 1 * t.mo_qh + consumibles_q);
  const total_sin_iva_q = redondeo2(Math.max(redondeo2(subtotal_q + margen_q), cobro_minimo));
  const con_factura_q = redondeo2(total_sin_iva_q * (1 + t.iva));
  const total_a_cobrar_q = redondeo2((entrada.factura ? con_factura_q : total_sin_iva_q) + envio);

  const baseCobro = entrada.factura ? con_factura_q : total_sin_iva_q;
  const precio_venta_final_q =
    entrada.precio_venta_final != null && entrada.precio_venta_final !== ""
      ? redondeo2(entrada.precio_venta_final)
      : baseCobro;
  const extra_ganado_q = redondeo2(precio_venta_final_q - baseCobro);

  return {
    material_q,
    maquina_q,
    mano_obra_q,
    consumibles_q,
    acabado_q,
    embalaje_q,
    subtotal_q,
    margen_q,
    total_sin_iva_q,
    con_factura_q,
    total_a_cobrar_q,
    base_cobro: baseCobro,
    precio_venta_final_q,
    extra_ganado_q,
  };
}

/**
 * resumenVenta(cantidad, precioUnit, factura, iva) → { subtotal_q, iva_q, total_q }
 */
export function resumenVenta(cantidad, precioUnit, factura, iva) {
  const cant = Math.max(1, Math.floor(Number(cantidad) || 1));
  const subtotal_q = redondeo2(clamp0(precioUnit) * cant);
  const iva_q = factura ? redondeo2(subtotal_q * iva) : 0;
  return { subtotal_q, iva_q, total_q: redondeo2(subtotal_q + iva_q) };
}

/**
 * sumarBandejas(rows) → totales del trabajo a partir del desglose.
 * rows: [{ n, gramos, horas_impresion, horas_mo, horas_pintura }]
 * cada fila equivale a n impresiones idénticas; los totales multiplican g/h/MO/pintura × n.
 */
export function sumarBandejas(rows) {
  const out = {
    bandejas: 0,
    gramos: 0,
    horas_impresion: 0,
    horas_mo: 0,
    horas_pintura: 0,
  };
  for (const p of rows ?? []) {
    const n = Math.max(1, Math.floor(Number(p.n) || 1));
    out.bandejas += n;
    out.gramos = redondeo2(out.gramos + clamp0(p.gramos) * n);
    out.horas_impresion = redondeo2(out.horas_impresion + clamp0(p.horas_impresion) * n);
    out.horas_mo = redondeo2(out.horas_mo + clamp0(p.horas_mo) * n);
    out.horas_pintura = redondeo2(out.horas_pintura + clamp0(p.horas_pintura) * n);
  }
  return out;
}
