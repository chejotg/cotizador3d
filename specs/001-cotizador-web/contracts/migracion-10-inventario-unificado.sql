-- Migración 10 — inventario unificado: stock_extra y minimo por pieza de bandeja
alter table cotizacion_pieza
  add column if not exists stock_extra int not null default 0,
  add column if not exists minimo int not null default 0;

-- vista v4: disponibles = en bandeja + stock extra − vendidas; alerta con mínimo
create or replace view piezas_bandeja with (security_invoker = true) as
  select pz.id, pz.folio, pz.nombre, pz.cantidad, pz.stock_extra, pz.minimo,
         pz.vendidas,
         pz.cantidad + pz.stock_extra - pz.vendidas as disponibles,
         ct.precio_venta_unidad, ct.cliente, ct.fecha,
         ct.estado, ct.metodo_cobro
    from cotizacion_pieza pz
    join cotizacion ct on ct.folio = pz.folio
   where ct.metodo_cobro = 'unidad';
