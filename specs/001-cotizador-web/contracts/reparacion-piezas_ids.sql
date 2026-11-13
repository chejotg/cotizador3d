-- Reparación (parte SQL): venta_combo_linea con pieza muerta + rebalanceo
-- (la remapación de combo_guardado se hace en scripts/reparar-ids.mjs)
with colgantes as (
  select l.pieza_id as viejo, l.cot_folio
    from venta_combo_linea l
   where l.pieza_id not in (select id from cotizacion_pieza)
),
unicas as (
  select c.folio,
         (select pz.id from cotizacion_pieza pz where pz.folio = c.folio limit 1) as id_nuevo
    from cotizacion c
   where (select count(*) from cotizacion_pieza pz where pz.folio = c.folio) = 1
)
update venta_combo_linea l
   set pieza_id = u.id_nuevo
  from colgantes g join unicas u on u.folio = g.cot_folio
 where l.pieza_id = g.viejo;

update cotizacion_pieza pz
   set vendidas = sub.total
  from (
    select pz2.id as pieza_id,
           coalesce((select sum(v.cantidad) from venta v
                      where v.producto = pz2.nombre
                        and v.owner_id = pz2.owner_id
                        and not v.anulada), 0)
         + coalesce((select sum(l.unidades) from venta_combo_linea l
                      join venta w on w.folio = l.folio_venta
                      where l.pieza_id = pz2.id
                        and w.owner_id = pz2.owner_id
                        and not w.anulada), 0) as total
      from cotizacion_pieza pz2
  ) sub
 where pz.id = sub.pieza_id;
