-- Limpieza del combo de prueba E2E (emula anular_venta como postgres)
update venta set anulada = true where folio = 'VT-003';
update cotizacion_pieza pz
   set vendidas = greatest(pz.vendidas - l.unidades, 0)
  from venta_combo_linea l
 where l.pieza_id = pz.id and l.folio_venta = 'VT-003';
