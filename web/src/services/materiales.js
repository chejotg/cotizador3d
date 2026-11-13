import { supabase } from "./supabase.js";

// materiales descontables (con tipo y costo) para el dropdown del cotizador
export async function fetchMaterialesDisponibles() {
  const { data, error } = await supabase
    .from("material")
    .select("nombre,unidad,costo_qg,descontable_por,stock_inicial,minimo")
    .not("descontable_por", "is", null)
    .gt("costo_qg", 0)
    .order("nombre");
  if (error) throw new Error(`No se pudieron cargar los materiales: ${error.message}`);
  return data ?? [];
}

// actualizar costo por gramo de un material (Inventario)
export async function updateMaterialCosto(nombre, costoQg) {
  const { error } = await supabase
    .from("material")
    .update({ costo_qg: Number(costoQg) })
    .eq("nombre", nombre);
  if (error) throw new Error(`No se pudo actualizar el costo de ${nombre}: ${error.message}`);
}

// crear un material nuevo (Inventario)
export async function crearMaterial({ nombre, unidad, descontablePor, costoQg, stockInicial, minimo }) {
  const { data, error } = await supabase
    .from("material")
    .insert({
      nombre: nombre.trim(),
      unidad: unidad || "g",
      descontable_por: descontablePor || null,
      costo_qg: Number(costoQg) || 0,
      stock_inicial: Number(stockInicial) || 0,
      minimo: Number(minimo) || 0,
    })
    .select();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un material con ese nombre");
    throw new Error(`No se pudo crear el material: ${error.message}`);
  }
  return data?.[0];
}

// eliminar un material (Inventario) — solo si no tiene cotizaciones que lo usen
export async function eliminarMaterial(nombre) {
  const { data: uso } = await supabase
    .from("cotizacion")
    .select("folio")
    .eq("material_usado", nombre)
    .limit(1);
  if (uso && uso.length > 0) {
    throw new Error(`No se puede eliminar: ${nombre} ya está usado en cotizaciones`);
  }
  const { error } = await supabase.from("material").delete().eq("nombre", nombre);
  if (error) throw new Error(`No se pudo eliminar ${nombre}: ${error.message}`);
}
