import { supabase } from "./supabase.js";
import { redondeo2 } from "../format.js";

const FIELD_MAP = {
  producto: "p_producto",
  tipo: "p_tipo",
  impresora: "p_impresora",
  bandejas: "p_bandejas",
  gramos: "p_gramos",
  horas_impresion: "p_horas_impresion",
  horas_mo: "p_horas_mo",
  horas_pintura: "p_horas_pintura",
  pintado: "p_pintado",
  embalaje: "p_embalaje",
  factura: "p_factura",
  envio_q: "p_envio_q",
};

// claves opcionales (bandeja/múltiples piezas/desglose por bandeja)
const EXTRA_MAP = {
  material_usado: "p_material",
  
  materiales: "p_materiales",
  es_bandeja: "p_es_bandeja",
  metodo_cobro: "p_metodo_cobro",
  piezas: "p_piezas", // array → jsonb string
  precio_venta_unidad: "p_precio_venta_unidad",
  bandejas_detalle: "p_bandejas_detalle", // array → jsonb string
};

function mapearArgs(formData) {
  const args = {};
  for (const [k, p] of Object.entries(FIELD_MAP)) args[p] = formData[k];
  for (const [k, p] of Object.entries(EXTRA_MAP)) {
    // los arrays van nativos: supabase-js los serializa para jsonb
    if (Array.isArray(formData[k])) args[p] = formData[k];
    else if (formData[k] !== undefined) args[p] = formData[k];
  }
  return args;
}

export async function listarCotizaciones() {
  const { data, error } = await supabase
    .from("cotizacion")
    .select("*")
    .order("folio", { ascending: false });
  if (error) throw new Error(`No se pudo cargar el historial: ${error.message}`);
  return data ?? [];
}

// una cotización por folio (para precarga de edición desde URL)
export async function cargarCotizacionPorFolio(folio) {
  const { data: row, error } = await supabase
    .from("cotizacion")
    .select("*")
    .eq("folio", folio)
    .limit(1)
    .single();
  if (error) throw new Error(`No encontré la cotización ${folio}: ${error.message}`);
  return row;
}

export async function guardarCotizacion(formData) {
  const args = mapearArgs(formData);
  args.p_fecha = formData.fecha || null;
  args.p_cliente = formData.cliente || null;
  const { data: row, error: rpcError } = await supabase.rpc("guardar_cotizacion", args);
  if (rpcError) throw traducirErrorRPC(rpcError, "guardar cotización");
  return row;
}

export async function editarCotizacion(folio, formData) {
  const args = mapearArgs(formData);
  args.p_folio = folio;
  args.p_fecha = formData.fecha || null;
  args.p_cliente = formData.cliente || null;
  args.p_estado = formData.estado || "Emitida";
  args.p_notas = formData.notas || null;
  const { data: row, error } = await supabase.rpc("editar_cotizacion", args);
  if (error) throw traducirErrorRPC(error, "editar cotización");
  return row;
}

export async function fijarPrecioVenta(folio, precio) {
  const { error } = await supabase
    .from("cotizacion")
    .update({ precio_venta_final: redondeo2(precio) })
    .eq("folio", folio);
  if (error) throw new Error(`No se pudo fijar el precio de venta: ${error.message}`);
}

// Eliminar cotización: bloqueada si ya tiene unidades vendidas (RPC valida)
export async function eliminarCotizacion(folio) {
  const { error } = await supabase.rpc("eliminar_cotizacion", { p_folio: folio });
  if (error) {
    const msg = error.message || "";
    if (msg.startsWith("VALIDATION_ERROR")) throw new Error(msg.replace("VALIDATION_ERROR:", "").trim());
    if (msg.startsWith("NOT_FOUND")) throw new Error(msg.replace("NOT_FOUND:", "").trim());
    throw new Error(`No se pudo eliminar: ${msg}`);
  }
}

export async function cambiarEstado(folio, estado) {
  const { error } = await supabase.from("cotizacion").update({ estado }).eq("folio", folio);
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
}

export async function fetchSaldosMaterial() {
  const { data, error } = await supabase
    .from("saldo_material")
    .select("nombre,unidad,saldo,minimo,alerta,descontable_por,stock_inicial");
  if (error) throw new Error(`No se pudo leer el stock: ${error.message}`);
  return data ?? [];
}

// extraGanado: derivado — precio venta manual vs base de cobro (factura ? con_factura : total_sin_iva)
export function extraGanado(cot) {
  const base = cot.factura ? Number(cot.con_factura_q) : Number(cot.total_sin_iva_q);
  const precio =
    cot.precio_venta_final != null ? Number(cot.precio_venta_final) : base;
  return redondeo2(precio - base);
}

function traducirErrorRPC(error, accion) {
  const msg = error?.message || String(error);
  if (msg.startsWith("AUTH_REQUIRED")) return new Error("Sesión requerida — vuelve a entrar");
  if (msg.startsWith("VALIDATION_ERROR")) return new Error(msg.replace("VALIDATION_ERROR:", "").trim());
  if (msg.startsWith("NOT_FOUND")) return new Error(msg.replace("NOT_FOUND:", "").trim());
  return new Error(`Error al ${accion}: ${msg}`);
}


