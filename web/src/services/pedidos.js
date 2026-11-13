import { supabase } from "./supabase.js";

// Seguimiento de pedidos y envíos (ventas activas con su estado de pedido)
export async function fetchPedidos() {
  const { data, error } = await supabase
    .from("venta")
    .select("*")
    .eq("anulada", false)
    .order("fecha", { ascending: false })
    .order("folio", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los pedidos: ${error.message}`);
  return data ?? [];
}

export async function actualizarPedido(folio, patch) {
  const args = { p_folio: folio };
  if (patch.estadoPedido !== undefined) args.p_estado_pedido = patch.estadoPedido || null;
  if (patch.metodoEnvio !== undefined) args.p_metodo_envio = patch.metodoEnvio;
  if (patch.costoEnvio !== undefined) args.p_costo_envio = patch.costoEnvio === "" ? null : Number(patch.costoEnvio);
  if (patch.tracking !== undefined) args.p_tracking = patch.tracking;
  if (patch.notas !== undefined) args.p_notas = patch.notas;
  if (patch.cliente !== undefined) args.p_cliente = patch.cliente;
  if (patch.direccion !== undefined) args.p_cliente_direccion = patch.direccion;
  if (patch.telefono !== undefined) args.p_cliente_telefono = patch.telefono;
  const { data: row, error } = await supabase.rpc("actualizar_pedido", args);
  if (error) {
    const msg = error.message || "";
    if (msg.startsWith("VALIDATION_ERROR")) throw new Error(msg.replace("VALIDATION_ERROR:", "").trim());
    throw new Error(`No se pudo actualizar el pedido: ${msg}`);
  }
  return row;
}

// eliminar pedido: devuelve las piezas vendidas y BORRA la venta (irreversible)
export async function eliminarPedido(folio) {
  const { error } = await supabase.rpc("eliminar_venta", { p_folio: folio });
  if (error) {
    const msg = error.message || "";
    if (msg.startsWith("NOT_FOUND")) throw new Error(msg.replace("NOT_FOUND:", "").trim());
    throw new Error(`No se pudo eliminar el pedido: ${msg}`);
  }
}
