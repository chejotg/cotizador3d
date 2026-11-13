-- Reparar la plantilla "pack navideño" para que incluya las 6 piezas navideñas
-- (COT-012 árbol + COT-011/010/009/008/006), y reparar la venta VT-002 que solo
-- descontó el árbol porque la plantilla tenía una sola línea.
update combo_guardado cg
   set lineas = (
     select jsonb_agg(jsonb_build_object('cot_folio', pz.folio, 'pieza_id', pz.id, 'unidades', 1))
       from cotizacion_pieza pz
      where pz.folio in ('COT-012','COT-011','COT-010','COT-009','COT-008','COT-006')
        and pz.owner_id = cg.owner_id
        and not exists (
          select 1 from cotizacion_pieza pz2
           where pz2.folio = pz.folio and pz2.owner_id = cg.owner_id and pz2.id < pz.id
        )
   )
 where cg.nombre = 'pack navideño';

-- reparar la venta VT-002: agregar las líneas que faltan
insert into venta_combo_linea (owner_id, folio_venta, cot_folio, pieza_id, unidades)
select v.owner_id, 'VT-002', pz.folio, pz.id, 1
  from venta v
  join cotizacion_pieza pz on pz.owner_id = v.owner_id
 where v.folio = 'VT-002'
   and pz.folio in ('COT-011','COT-010','COT-009','COT-008','COT-006')
   and not exists (select 1 from venta_combo_linea l where l.folio_venta = 'VT-002' and l.pieza_id = pz.id)
   and not exists (select 1 from cotizacion_pieza pz2 where pz2.folio = pz.folio and pz2.owner_id = pz.owner_id and pz2.id < pz.id);

-- rebalanceo de vendidas desde las ventas vigentes
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
