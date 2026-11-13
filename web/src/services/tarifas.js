import { supabase } from "./supabase.js";

// fetchTarifas() → { clave: valor ... } desde la tabla `tarifa` (un solo select)
export async function fetchTarifas() {
  const { data, error } = await supabase.from("tarifa").select("clave,valor");
  if (error) throw new Error(`No se pudieron cargar las tarifas: ${error.message}`);
  const out = {};
  for (const row of data ?? []) out[row.clave] = Number(row.valor);
  return out;
}

export async function updateTarifa(clave, valor) {
  const { error } = await supabase
    .from("tarifa")
    .update({ valor: Number(valor), updated_at: new Date().toISOString() })
    .eq("clave", clave);
  if (error) throw new Error(`No se pudo actualizar ${clave}: ${error.message}`);
}
