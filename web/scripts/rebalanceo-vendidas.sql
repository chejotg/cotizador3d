-- Re-equilibrar vendidas de las piezas activas desde las ventas vigentes (no anuladas)
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
