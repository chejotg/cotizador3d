-- Migración 18 — estados de cobro en venta (promoción, pagado, pendiente de cobro)
alter table venta
  add column if not exists estado_cobro text not null default 'pendiente_cobro',
  add constraint venta_estado_cobro_chk
    check (estado_cobro in ('promocion','pagado','pendiente_cobro'));

-- actualizar_pedido v3: acepta estado_cobro
drop function if exists actualizar_pedido(text, text, text, numeric, text, text, text, text, text);
create or replace function actualizar_pedido(
  p_folio text,
  p_estado_pedido text default null,
  p_metodo_envio text default null,
  p_costo_envio numeric default null,
  p_tracking text default null,
  p_notas text default null,
  p_cliente text default null,
  p_cliente_direccion text default null,
  p_cliente_telefono text default null,
  p_estado_cobro text default null
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
  if p_estado_cobro is not null and p_estado_cobro not in
     ('promocion','pagado','pendiente_cobro') then
    raise exception 'VALIDATION_ERROR: estado de cobro invalido';
  end if;
  update venta set
    estado_pedido = coalesce(p_estado_pedido, estado_pedido),
    metodo_envio = coalesce(p_metodo_envio, metodo_envio),
    costo_envio = coalesce(p_costo_envio, costo_envio),
    tracking = coalesce(p_tracking, tracking),
    notas = coalesce(nullif(btrim(coalesce(p_notas,'')), ''), notas),
    cliente = coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), cliente),
    cliente_direccion = coalesce(nullif(btrim(coalesce(p_cliente_direccion,'')), ''), cliente_direccion),
    cliente_telefono = coalesce(nullif(btrim(coalesce(p_cliente_telefono,'')), ''), cliente_telefono),
    estado_cobro = coalesce(p_estado_cobro, estado_cobro)
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;
  if not found then raise exception 'NOT_FOUND: venta no existe'; end if;
  return out_row;
end; $$;
revoke execute on function actualizar_pedido from public, anon;
grant execute on function actualizar_pedido to authenticated;
