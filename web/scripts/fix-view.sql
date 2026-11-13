-- v2 de saldo_material: expone stock_inicial + alerta (necesarios en la web)
drop view if exists saldo_material cascade;
create or replace view saldo_material with (security_invoker = true) as
  select m.nombre, m.unidad, m.descontable_por, m.stock_inicial, m.minimo,
         m.stock_inicial
           + coalesce((select sum(mm.entrada) from movimiento_material mm
                        where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
           - coalesce((select sum(cm.consumido) from consumo_material cm
                        where cm.material = m.nombre and m.descontable_por is not null
                        and cm.unidad = m.unidad), 0)
           - coalesce((select sum(mm.salida) from movimiento_material mm
                        where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
         as saldo,
         case when m.minimo > 0
              and m.stock_inicial
                      + coalesce((select sum(mm.entrada) from movimiento_material mm
                                   where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
                      - coalesce((select sum(cm.consumido) from consumo_material cm
                                   where cm.material = m.nombre and m.descontable_por is not null
                                   and cm.unidad = m.unidad), 0)
                      - coalesce((select sum(mm.salida) from movimiento_material mm
                                   where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
                 <= m.minimo
              then 'REPOSICION' else 'ok' end as alerta
    from material m;
