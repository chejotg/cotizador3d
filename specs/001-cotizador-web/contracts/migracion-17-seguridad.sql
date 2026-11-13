-- Migración 17 — CIERRE DE SEGURIDAD para producción
-- Corrige todo lo que la auditoría detectó

-- 1. REVOKE grants de anon en TODAS las vistas (Postgres les otorga PUBLIC por defecto)
revoke all on consumo_material from anon, public;
revoke all on desglose_ventas from anon, public;
revoke all on piezas_bandeja from anon, public;
revoke all on saldo_material from anon, public;
revoke all on saldo_producto from anon, public;

-- 2. Grant a authenticated para las vistas (solo SELECT)
grant select on consumo_material to authenticated;
grant select on desglose_ventas to authenticated;
grant select on piezas_bandeja to authenticated;
grant select on saldo_material to authenticated;
grant select on saldo_producto to authenticated;

-- 3. REVOKE execute de todas las funciones RPC para anon y public
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fnsig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'calcular_componentes_cot', 'crear_producto_on_confirm',
         'guardar_cotizacion', 'editar_cotizacion',
         'registrar_venta', 'registrar_combo', 'vender_unidad_bandeja',
         'anular_venta', 'eliminar_cotizacion', 'eliminar_venta',
         'actualizar_pedido', 'jsonb_a_array'
       )
  loop
    execute format('revoke execute on function %s from public, anon;', r.fnsig);
    raise notice 'revoked %', r.fnsig;
  end loop;
end $$;

-- 4. Grant execute solo a authenticated

grant execute on function crear_producto_on_confirm to authenticated;
grant execute on function guardar_cotizacion to authenticated;
grant execute on function editar_cotizacion to authenticated;
grant execute on function registrar_venta to authenticated;
grant execute on function registrar_combo to authenticated;
grant execute on function vender_unidad_bandeja to authenticated;
grant execute on function anular_venta to authenticated;
grant execute on function eliminar_cotizacion to authenticated;
grant execute on function eliminar_venta to authenticated;
grant execute on function actualizar_pedido to authenticated;
grant execute on function jsonb_a_array to authenticated;

-- 5. REVOKE grants generales del rol anon en las tablas base
-- (por si Postgres les otorgó algo automático)
revoke all on combo_guardado from anon;
revoke all on cotizacion from anon;
revoke all on cotizacion_material from anon;
revoke all on cotizacion_pieza from anon;
revoke all on material from anon;
revoke all on movimiento_material from anon;
revoke all on movimiento_producto from anon;
revoke all on producto from anon;
revoke all on tarifa from anon;
revoke all on venta from anon;
revoke all on venta_combo_linea from anon;
revoke all on cotizacion_material from anon;

-- 6. Auth: deshabilitar signup público (solo el propietario debe poder entrar)
-- Nota: esto se configura en el dashboard de Supabase: Authentication → Providers → Email → "Enable sign-ups" OFF
-- Por seguridad adicional, si alguien intenta registrarse via API sin ser owner, no tendrá acceso a datos (RLS).

-- 7. Confirmar que el email del propietario está confirmado
-- (ya se confirmó por SQL anteriormente, verificado)

