-- Crear productos faltantes para las cotizaciones Confirmadas sin producto en el POS
insert into producto (owner_id, nombre, precio_sin_iva, nota, stock_inicial, minimo)
select c.owner_id, c.producto, c.total_sin_iva_q, c.folio, 0, 0
  from cotizacion c
 where c.estado = 'Confirmada'
   and not exists (
     select 1 from producto p
      where p.nota = c.folio and p.owner_id = c.owner_id
   )
on conflict (owner_id, nombre) do nothing;

-- Trigger: cuando una cotización pasa a Confirmada, auto-crear su producto en el catálogo
create or replace function crear_producto_on_confirm()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado = 'Confirmada' and (old.estado is null or old.estado <> 'Confirmada') then
    insert into producto (owner_id, nombre, precio_sin_iva, nota, stock_inicial, minimo)
    values (new.owner_id, new.producto, new.total_sin_iva_q, new.folio, 0, 0)
    on conflict (owner_id, nombre) do update
      set precio_sin_iva = new.total_sin_iva_q, nota = new.folio;
  end if;
  return new;
end; $$;

drop trigger if exists trg_cot_confirm_producto on cotizacion;
create trigger trg_cot_confirm_producto
  after update of estado on cotizacion
  for each row
  execute function crear_producto_on_confirm();
