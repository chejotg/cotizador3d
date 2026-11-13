-- v2 de saldo_producto: expone stock_inicial (para edicion inline)
drop view if exists saldo_producto cascade;
create or replace view saldo_producto with (security_invoker = true) as
  select p.nombre, p.stock_inicial, p.minimo,
         p.stock_inicial
           + coalesce((select sum(mp.entrada) from movimiento_producto mp
                        where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
           - coalesce((select sum(v.cantidad) from venta v
                        where v.producto = p.nombre and v.owner_id = p.owner_id
                        and not v.anulada), 0)
           - coalesce((select sum(mp.salida) from movimiento_producto mp
                        where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
         as saldo,
         case when p.minimo > 0
              and p.stock_inicial
                      + coalesce((select sum(mp.entrada) from movimiento_producto mp
                                   where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
                      - coalesce((select sum(v.cantidad) from venta v
                                   where v.producto = p.nombre and v.owner_id = p.owner_id
                                   and not v.anulada), 0)
                      - coalesce((select sum(mp.salida) from movimiento_producto mp
                                   where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
                 <= p.minimo
              then 'REPOSICION' else 'ok' end as alerta
    from producto p;
