import { supabase } from "./supabase.js";

// TODAS las piezas de bandejas por unidad (cualquier estado) — para el Inventario.
// El POS debe filtrar estado = "Confirmada" (regla: Emitidas no se venden, Canceladas no se muestran).
export async function fetchPiezasBandeja() {
  const { data, error } = await supabase
    .from("piezas_bandeja")
    .select("id,folio,nombre,cantidad,stock_extra,minimo,vendidas,disponibles,precio_venta_unidad,cliente,fecha,estado")
    .order("folio", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las piezas de bandejas: ${error.message}`);
  return data ?? [];
}

// stock extra / mínimo de una pieza de bandeja (para reposiciones desde Inventario)
export async function updatePiezaStock(id, { stockExtra, minimo }) {
  const patch = {};
  if (stockExtra !== undefined) patch.stock_extra = Number(stockExtra) || 0;
  if (minimo !== undefined) patch.minimo = Number(minimo) || 0;
  const { error } = await supabase.from("cotizacion_pieza").update(patch).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar el stock de la pieza: ${error.message}`);
}

export async function fetchPiezasPorFolio(folio) {
  const { data, error } = await supabase
    .from("cotizacion_pieza")
    .select("id,nombre,cantidad,vendidas")
    .eq("folio", folio);
  if (error) throw new Error(`No se pudieron cargar las piezas de ${folio}: ${error.message}`);
  return data ?? [];
}

// vender N unidades de 1 pieza (método unidad)
export async function venderUnidadBandeja({ cotFolio, piezaId, unidades, precioUnit, factura, fecha, cliente, direccion, telefono }) {
  const { data: row, error } = await supabase.rpc("vender_unidad_bandeja", {
    p_cot_folio: cotFolio,
    p_pieza_id: piezaId,
    p_unidades: unidades,
    p_precio_unit: precioUnit,
    p_factura: factura,
    p_fecha: fecha || null,
    p_cliente: cliente || null,
    p_cliente_direccion: direccion || null,
    p_cliente_telefono: telefono || null,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.startsWith("VALIDATION_ERROR")) throw new Error(msg.replace("VALIDATION_ERROR:", "").trim());
    if (msg.startsWith("NOT_FOUND")) throw new Error(msg.replace("NOT_FOUND:", "").trim());
    if (msg.startsWith("AUTH_REQUIRED")) throw new Error("Sesión requerida — vuelve a entrar");
    throw new Error(`Error al vender: ${msg}`);
  }
  return row;
}

// registrar combo: lineas [{cot_folio, pieza_id, unidades}]
export async function registrarCombo({ nombre, lineas, precioUnit, factura, fecha, cliente }) {
  const { data: row, error } = await supabase.rpc("registrar_combo", {
    p_nombre: nombre,
    p_lineas: lineas.map((l) => ({ cot_folio: l.folio, pieza_id: l.piezaId, unidades: l.unidades })),
    p_precio_unit: precioUnit,
    p_factura: factura,
    p_fecha: fecha || null,
    p_cliente: cliente || null,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.startsWith("VALIDATION_ERROR")) throw new Error(msg.replace("VALIDATION_ERROR:", "").trim());
    if (msg.startsWith("NOT_FOUND")) throw new Error(msg.replace("NOT_FOUND:", "").trim());
    throw new Error(`Error al registrar el combo: ${msg}`);
  }
  return row;
}

// Plantillas de combos (venta rápida)
export async function fetchCombosGuardados() {
  const { data, error } = await supabase
    .from("combo_guardado")
    .select("id,nombre,nota,lineas,precio")
    .order("nombre");
  // lineas viene como jsonb (array de objetos)
  if (error) throw new Error(`No se pudieron cargar los combos guardados: ${error.message}`);
  return data ?? [];
}

export async function guardarComboPlantilla({ nombre, lineas, precio, nota }) {
  const { data, error } = await supabase
    .from("combo_guardado")
    .insert({
      nombre: String(nombre).trim(),
      lineas: lineas.map((l) => ({
        cot_folio: l.folio,
        pieza_id: l.piezaId,
        unidades: l.unidades,
      })),
      precio: precio == null || precio === "" ? null : Number(precio),
      nota: nota || null,
    })
    .select();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un combo con ese nombre");
    throw new Error(`No se pudo guardar el combo: ${error.message}`);
  }
  return data?.[0];
}

export async function eliminarComboGuardado(id) {
  const { error } = await supabase.from("combo_guardado").delete().eq("id", id);
  if (error) throw new Error(`No se pudo eliminar el combo guardado: ${error.message}`);
}
