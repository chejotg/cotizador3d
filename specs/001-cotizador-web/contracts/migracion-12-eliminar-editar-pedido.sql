-- Migración 12 — eliminar ventas desde Pedidos + editar datos del cliente/contacto
-- actualizar_pedido v2: agrega cliente / dirección / teléfono
drop function if exists actualizar_pedido(text, text, text, numeric, text, text);
create or replace function actualizar_pedido(
  p_folio text,
  p_estado_pedido text default null,
  p_metodo_envio text default null,
  p_costo_envio numeric default null,
  p_tracking text default null,
  p_notas text default null,
  p_cliente text default null,
  p_cliente_direccion text default null,
  p_cliente_telefono text default null
) returns venta
language plpgsql security definer set search_path = public
as $$
declare out_row venta;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_estado_pedido is not null and p_estado_pedido not in
     ('Nuevo','Preparando','Enviado','Entregado','Cancelado') then
    raise exception 'VALIDATION_ERROR: estado de pedido invalido';
  end if;
  update venta set
    estado_pedido = coalesce(p_estado_pedido, estado_pedido),
    metodo_envio = coalesce(p_metodo_envio, metodo_envio),
    costo_envio = coalesce(p_costo_envio, costo_envio),
    tracking = coalesce(p_tracking, tracking),
    notas = coalesce(nullif(btrim(coalesce(p_notas,'')), ''), notas),
    cliente = coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), cliente),
    cliente_direccion = coalesce(nullif(btrim(coalesce(p_cliente_direccion,'')), ''), cliente_direccion),
    cliente_telefono = coalesce(nullif(btrim(coalesce(p_cliente_telefono,'')), ''), cliente_telefono)
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;
  if not found then raise exception 'NOT_FOUND: venta no existe'; end if;
  return out_row;
end; $$;
revoke execute on function actualizar_pedido from public, anon;
grant execute on function actualizar_pedido to authenticated;

-- eliminar venta: devuelve las unidades de piezas y BORRA el registro (con sus líneas en cascada)
create or replace function eliminar_venta(p_folio text) returns void
language plpgsql security definer set search_path = public
as $$
declare linea record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from venta where folio = p_folio and owner_id = auth.uid()) then
    raise exception 'NOT_FOUND: venta no existe';
  end if;
  -- devolver unidades de piezas (ventas por unidad y combos)
  for linea in select * from venta_combo_linea where folio_venta = p_folio and owner_id = auth.uid() loop
    update cotizacion_pieza set vendidas = greatest(vendidas - linea.unidades, 0)
      where id = linea.pieza_id;
  end loop;
  delete from venta where folio = p_folio and owner_id = auth.uid(); -- cascade: venta_combo_linea
end; $$;
revoke execute on function eliminar_venta from public, anon;
grant execute on function eliminar_venta to authenticated;
