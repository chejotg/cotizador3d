-- Eliminar TODAS las ventas (solicitud del propietario) + reinicio de folios y contadores
delete from venta;                    -- cascade limpia venta_combo_linea
select setval('folio_venta_seq', 1, false);
update cotizacion_pieza set vendidas = 0;
