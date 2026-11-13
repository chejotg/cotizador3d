-- Migración 7 — registrar_combo normaliza p_lineas (jsonb escalar → array)
create or replace function registrar_combo(
  p_nombre text, p_lineas jsonb,
  p_precio_unit numeric default null, p_factura boolean default false,
  p_fecha date default null, p_cliente text default null
) returns venta
language plpgsql security definer set search_path = public
as $$
declare v_nombre text; v_linea jsonb; v_folio_v text; v_folio_n int;
        v_total numeric(12,2) := 0; v_iva numeric(12,2); v_iva_pct numeric(12,4);
        v_precio_l numeric(12,2); v_uni int; v_disponibles int; v_sub numeric(12,2);
        v_lineas jsonb; out_row venta;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_lineas := jsonb_a_array(p_lineas);
  if p_nombre is null or length(btrim(p_nombre)) = 0 then
    raise exception 'VALIDATION_ERROR: nombre del combo requerido';
  end if;
  if v_lineas is null or jsonb_array_length(v_lineas) = 0 then
    raise exception 'VALIDATION_ERROR: el combo necesita piezas';
  end if;

  -- validar disponibilidad de cada línea (lock) y computar precio default pieza a pieza
  for v_linea in select jsonb_array_elements(v_lineas) loop
    v_uni := coalesce((v_linea->>'unidades')::int, 1);
    select pz.cantidad - pz.vendidas, coalesce(cu.precio_venta_unidad, 0), pz.nombre
      into v_disponibles, v_precio_l, v_nombre
      from cotizacion_pieza pz join cotizacion cu on cu.folio = pz.folio
      where pz.id = (v_linea->>'pieza_id')::uuid for update of pz;
    if not found then raise exception 'NOT_FOUND: pieza del combo no existe'; end if;
    if v_uni < 1 then raise exception 'VALIDATION_ERROR: unidades >= 1'; end if;
    if v_uni > v_disponibles then
      raise exception 'VALIDATION_ERROR: no hay unidades suficientes de % (quedan %)', v_nombre, v_disponibles;
    end if;
    if p_precio_unit is null or p_precio_unit < 0 then
      v_total := v_total + round(v_precio_l * v_uni, 2);
    else
      v_total := p_precio_unit;
    end if;
  end loop;

  select valor into v_iva_pct from tarifa where clave = 'iva';
  v_sub := round(v_total, 2);
  v_iva := case when p_factura then round(v_sub * v_iva_pct, 2) else 0 end;
  v_folio_n := nextval('folio_venta_seq');
  v_folio_v := 'VT-' || lpad(v_folio_n::text, 3, '0');

  insert into venta (owner_id, folio, fecha, cliente, producto, cantidad, precio_unit,
                     factura, subtotal_q, iva_q, total_q)
    values (auth.uid(), v_folio_v, coalesce(p_fecha, current_date),
            coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(mostrador)'),
            btrim(p_nombre), 1, v_sub, p_factura, v_sub, v_iva, v_sub + v_iva)
    returning * into out_row;

  for v_linea in select jsonb_array_elements(v_lineas) loop
    v_uni := coalesce((v_linea->>'unidades')::int, 1);
    update cotizacion_pieza set vendidas = vendidas + v_uni
      where id = (v_linea->>'pieza_id')::uuid;
    insert into venta_combo_linea (owner_id, folio_venta, cot_folio, pieza_id, unidades)
      values (auth.uid(), v_folio_v, v_linea->>'cot_folio', (v_linea->>'pieza_id')::uuid, v_uni);
  end loop;

  return out_row;
end; $$;
