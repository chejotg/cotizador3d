-- Migración 13 — vista de desglose de ventas por rubro
-- Para cada venta no anulada, calcula cuánto del precio de venta corresponde a cada rubro
-- de producción (material, máquina, mano de obra, consumibles, acabado, embalaje),
-- cuánto queda como margen/ganancia real, y cuánto es IVA (para el SAT).
create or replace view desglose_ventas with (security_invoker = true) as
with lineas as (
  select
    l.folio_venta, l.cot_folio, l.pieza_id, l.unidades,
    v.fecha, v.cliente, v.producto, v.total_q, v.iva_q, v.factura, v.anulada
  from venta v
  join venta_combo_linea l on l.folio_venta = v.folio
  where not v.anulada
),
costos_por_linea as (
  select
    ln.folio_venta, ln.cot_folio, ln.unidades, ln.fecha, ln.cliente, ln.producto,
    ln.total_q, ln.iva_q, ln.factura,
    (c.material_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as material_q,
    (c.maquina_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as maquina_q,
    (c.mano_obra_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as mano_obra_q,
    (c.consumibles_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as consumibles_q,
    (c.acabado_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as acabado_q,
    (c.embalaje_q / greatest(pz.cantidad + pz.stock_extra, 1)) * ln.unidades as embalaje_q
  from lineas ln
  join cotizacion_pieza pz on pz.id = ln.pieza_id
  join cotizacion c on c.folio = ln.cot_folio
),
agregado as (
  select
    folio_venta as folio,
    max(fecha) as fecha,
    max(cliente) as cliente,
    max(producto) as producto,
    max(total_q) as total_q,
    max(iva_q) as iva_q,
    max(factura::int)::boolean as factura,
    sum(material_q) as material_q,
    sum(maquina_q) as maquina_q,
    sum(mano_obra_q) as mano_obra_q,
    sum(consumibles_q) as consumibles_q,
    sum(acabado_q) as acabado_q,
    sum(embalaje_q) as embalaje_q
  from costos_por_linea
  group by folio_venta
)
select
  a.folio,
  a.fecha,
  a.cliente,
  a.producto,
  a.total_q,
  a.iva_q,
  a.factura,
  round(a.material_q, 2) as material_q,
  round(a.maquina_q, 2) as maquina_q,
  round(a.mano_obra_q, 2) as mano_obra_q,
  round(a.consumibles_q, 2) as consumibles_q,
  round(a.acabado_q, 2) as acabado_q,
  round(a.embalaje_q, 2) as embalaje_q,
  round(a.material_q + a.maquina_q + a.mano_obra_q + a.consumibles_q + a.acabado_q + a.embalaje_q, 2) as costo_total,
  round(a.total_q - (a.material_q + a.maquina_q + a.mano_obra_q + a.consumibles_q + a.acabado_q + a.embalaje_q) - a.iva_q, 2) as margen_real,
  round((a.total_q - a.iva_q) - (a.material_q + a.maquina_q + a.mano_obra_q + a.consumibles_q + a.acabado_q + a.embalaje_q), 2) as margen_sin_iva
from agregado a;
