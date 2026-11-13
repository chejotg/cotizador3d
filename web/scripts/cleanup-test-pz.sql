-- Limpieza de cotizaciones de prueba previas (sin ventas ligadas)
delete from cotizacion where producto = 'Test pz fix' and folio in ('COT-021');
