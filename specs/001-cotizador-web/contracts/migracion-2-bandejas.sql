-- Migración 2 — Bandejas multi-pieza, cobro por unidad y combos (001-cotizador-web)
-- Ejecutar DESPUÉS de db-schema.sql (complementa, no reemplaza). Deny-by-default igual.

-- ============ columnas nuevas en cotizacion ============
alter table cotizacion add column if not exists es_bandeja boolean not null default false;
alter table cotizacion add column if not exists metodo_cobro text not null default 'total',
  add constraint cot_metodo_cobro_chk check (metodo_cobro in ('total','unidad'));
alter table cotizacion add column if not exists precio_venta_unidad numeric(12,2);

-- ============ piezas de una bandeja ============
create table if not exists cotizacion_pieza (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  folio text not null,
  nombre text not null,
  cantidad int not null default 1 check (cantidad >= 1),
  vendidas int not null default 0 check (vendidas >= 0),
  created_at timestamptz not null default now(),
  unique (folio, nombre),
  foreign key (folio) references cotizacion (folio) on delete cascade
);
create index if not exists cotp_folio on cotizacion_pieza (folio);
alter table cotizacion_pieza enable row level security;
revoke all on cotizacion_pieza from anon;
create policy "cotp owner all" on cotizacion_pieza for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ detalle de combos vendidos ============
create table if not exists venta_combo_linea (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  folio_venta text not null,
  cot_folio text not null,
  pieza_id uuid not null,
  unidades int not null default 1 check (unidades >= 1),
  foreign key (folio_venta) references venta (folio) on delete cascade
);
create index if not exists vcl_folio on venta_combo_linea (folio_venta);
alter table venta_combo_linea enable row level security;
revoke all on venta_combo_linea from anon;
create policy "vcl owner all" on venta_combo_linea for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ vista: unidades disponibles por pieza (método unidad) ============
create or replace view piezas_bandeja with (security_invoker = true) as
  select pz.id, pz.folio, pz.nombre, pz.cantidad, pz.vendidas,
         pz.cantidad - pz.vendidas as disponibles,
         ct.precio_venta_unidad, ct.cliente, ct.fecha
    from cotizacion_pieza pz
    join cotizacion ct on ct.folio = pz.folio
   where ct.metodo_cobro = 'unidad';

-- ============ helper: unidades de una lista de piezas (jsonb) ============
-- p_lineas formato jsonb: [{"cot_folio":"COT-019","pieza_id":"uuid","unidades":2}, ...]

-- ============ guardar_cotizacion v2 (bandeja + piezas jsonb) ============
-- Sobrecarga: con p_es_bandeja la cotización es una bandeja con varias piezas.
create or replace function guardar_cotizacion(
  p_fecha date default null, p_cliente text default null, p_producto text default null,
  p_tipo text default null, p_impresora text default null, p_bandejas int default 1,
  p_gramos numeric default null, p_horas_impresion numeric default null, p_horas_mo numeric default null,
  p_horas_pintura numeric default 0, p_pintado boolean default false,
  p_embalaje text default 'Ninguno', p_factura boolean default false,
  p_envio_q numeric default 0,
  p_es_bandeja boolean default false,
  p_metodo_cobro text default 'total',
  p_piezas jsonb default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_folio_n int; v_folio text; v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_producto is null or length(btrim(p_producto)) = 0 then
    raise exception 'VALIDATION_ERROR: producto requerido';
  end if;
  if p_tipo = 'PLA' and p_impresora <> 'Creator 5' then
    raise exception 'VALIDATION_ERROR: tipo PLA solo con Creator 5';
  end if;
  if p_tipo = 'Resina' and p_impresora in ('Creator 5') then
    raise exception 'VALIDATION_ERROR: tipo Resina con Saturn 4 o Saturn 3';
  end if;
  if p_es_bandeja then
    if p_metodo_cobro not in ('total','unidad') then
      raise exception 'VALIDATION_ERROR: metodo_cobro invalido';
    end if;
    if p_piezas is null or jsonb_array_length(p_piezas) = 0 then
      raise exception 'VALIDATION_ERROR: la bandeja necesita al menos una pieza';
    end if;
  end if;

  select * into c from calcular_componentes_cot(
    p_gramos, p_tipo, p_impresora, p_bandejas, p_horas_impresion,
    p_horas_mo, p_horas_pintura, p_pintado, p_embalaje, p_factura, p_envio_q);

  v_folio_n := nextval('folio_cotizacion_seq');
  v_folio := 'COT-' || lpad(v_folio_n::text, 3, '0');

  insert into cotizacion (owner_id, folio, fecha, cliente, producto, tipo, impresora,
    bandejas, gramos, horas_impresion, horas_mo, horas_pintura, pintado, embalaje,
    factura, envio_q, es_bandeja, metodo_cobro,
    material_q, maquina_q, mano_obra_q, consumibles_q, acabado_q, embalaje_q,
    subtotal_q, margen_q, total_sin_iva_q, con_factura_q, total_a_cobrar_q)
  values (auth.uid(), v_folio,
          coalesce(p_fecha, current_date),
          coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(por definir)'),
          btrim(p_producto), p_tipo, p_impresora,
          p_bandejas, p_gramos, p_horas_impresion, p_horas_mo, p_horas_pintura,
          p_pintado, p_embalaje, p_factura, p_envio_q,
          p_es_bandeja, case when p_es_bandeja then p_metodo_cobro else 'total' end,
          c.material_q, c.maquina_q, c.mano_obra_q, c.consumibles_q, c.acabado_q,
          c.embalaje_q, c.subtotal_q, c.margen_q, c.total_sin_iva_q,
          c.con_factura_q, c.total_a_cobrar_q)
  returning * into out_row;

  if p_es_bandeja then
    v_unidades := 0;
    for pz in select j->>'nombre' as nombre, coalesce((j->>'cantidad')::int, 1) as cantidad
              from jsonb_array_elements(p_piezas) as j
    loop
      if btrim(coalesce(pz.nombre,'')) = '' then
        raise exception 'VALIDATION_ERROR: pieza sin nombre en la bandeja';
      end if;
      insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
        values (auth.uid(), v_folio, btrim(pz.nombre), pz.cantidad);
      if pz.cantidad < 1 then raise exception 'VALIDATION_ERROR: cantidad de pieza >= 1'; end if;
      v_unidades := v_unidades + pz.cantidad;
    end loop;
    if p_metodo_cobro = 'unidad' and v_unidades > 0 then
      v_pu := round(out_row.total_a_cobrar_q / v_unidades, 2);
      update cotizacion set precio_venta_unidad = v_pu where folio = v_folio;
    end if;
  end if;

  select * into out_row from cotizacion where folio = v_folio and owner_id = auth.uid();
  return out_row;
end; $$;

-- editar_cotizacion v2: misma firma que v1 + bandeja/piezas opcionales
create or replace function editar_cotizacion(
  p_folio text, p_fecha date, p_cliente text, p_producto text,
  p_tipo text, p_impresora text, p_bandejas int,
  p_gramos numeric, p_horas_impresion numeric, p_horas_mo numeric,
  p_horas_pintura numeric, p_pintado boolean, p_embalaje text,
  p_factura boolean, p_envio_q numeric, p_estado text,
  p_notas text default null,
  p_es_bandeja boolean default null,
  p_metodo_cobro text default null,
  p_piezas jsonb default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_prev numeric(12,2); v_est_bandeja boolean; v_est_metodo text;
        v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select total_a_cobrar_q, es_bandeja, metodo_cobro into v_prev, v_est_bandeja, v_est_metodo
    from cotizacion where folio = p_folio and owner_id = auth.uid();
  if not found then raise exception 'NOT_FOUND: cotizacion no existe'; end if;

  if p_es_bandeja is not null then v_est_bandeja := p_es_bandeja; end if;
  if p_metodo_cobro is not null then v_est_metodo := p_metodo_cobro; end if;
  if v_est_bandeja then
    if p_piezas is null then raise exception 'VALIDATION_ERROR: la bandeja necesita sus piezas'; end if;
    if jsonb_array_length(p_piezas) = 0 then raise exception 'VALIDATION_ERROR: al menos una pieza'; end if;
  end if;

  select * into c from calcular_componentes_cot(
    p_gramos, p_tipo, p_impresora, p_bandejas, p_horas_impresion,
    p_horas_mo, p_horas_pintura, p_pintado, p_embalaje, p_factura, p_envio_q);

  update cotizacion set
    fecha = p_fecha,
    cliente = coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), cliente),
    producto = btrim(p_producto),
    tipo = p_tipo, impresora = p_impresora, bandejas = p_bandejas, gramos = p_gramos,
    horas_impresion = p_horas_impresion, horas_mo = p_horas_mo,
    horas_pintura = p_horas_pintura, pintado = p_pintado, embalaje = p_embalaje,
    factura = p_factura, envio_q = p_envio_q, estado = p_estado,
    notas = coalesce(nullif(btrim(coalesce(p_notas, '')), ''), notas),
    es_bandeja = v_est_bandeja,
    metodo_cobro = case when v_est_bandeja then v_est_metodo else 'total' end,
    hist_total_previo = v_prev,
    material_q = c.material_q, maquina_q = c.maquina_q,
    mano_obra_q = c.mano_obra_q, consumibles_q = c.consumibles_q,
    acabado_q = c.acabado_q, embalaje_q = c.embalaje_q,
    subtotal_q = c.subtotal_q, margen_q = c.margen_q,
    total_sin_iva_q = c.total_sin_iva_q, con_factura_q = c.con_factura_q,
    total_a_cobrar_q = c.total_a_cobrar_q
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;

  -- piezas: reemplaza la lista conservando vendidas cuando el nombre coincide
  if v_est_bandeja and p_piezas is not null then
    delete from cotizacion_pieza where folio = p_folio and owner_id = auth.uid();
    v_unidades := 0;
    for pz in select j->>'nombre' as nombre, coalesce((j->>'cantidad')::int, 1) as cantidad
              from jsonb_array_elements(p_piezas) as j
    loop
      insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
        values (auth.uid(), p_folio, btrim(pz.nombre), greatest(pz.cantidad, 1));
      v_unidades := v_unidades + greatest(pz.cantidad, 1);
    end loop;
    if v_est_metodo = 'unidad' and v_unidades > 0 then
      v_pu := round(out_row.total_a_cobrar_q / v_unidades, 2);
      update cotizacion set precio_venta_unidad = v_pu where folio = p_folio;
    else
      update cotizacion set precio_venta_unidad = null where folio = p_folio;
    end if;
  elsif not v_est_bandeja then
    delete from cotizacion_pieza where folio = p_folio and owner_id = auth.uid();
  end if;

  select * into out_row from cotizacion where folio = p_folio and owner_id = auth.uid();
  return out_row;
end; $$;

-- ============ venta de unidades de una pieza de bandeja ============
create or replace function vender_unidad_bandeja(
  p_cot_folio text, p_pieza_id uuid, p_unidades int default 1,
  p_precio_unit numeric default null, p_factura boolean default false,
  p_fecha date default null, p_cliente text default null
) returns venta
language plpgsql security definer set search_path = public
as $$
declare v_precio numeric(12,2); v_sub numeric(12,2); v_iva numeric(12,2);
        v_iva_pct numeric(12,4); v_disponibles int; v_folio_n int; v_folio text;
        v_nombre text; v_owner uuid; out_row venta;begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_unidades < 1 then raise exception 'VALIDATION_ERROR: unidades >= 1'; end if;

  select pz.nombre, pz.cantidad - pz.vendidas as disponibles, pz.owner_id,
         ct.precio_venta_unidad
    into v_nombre, v_disponibles, v_owner, v_precio
    from cotizacion_pieza pz join cotizacion ct on ct.folio = pz.folio
    where pz.id = p_pieza_id and ct.metodo_cobro = 'unidad' for update of pz;
  if not found then raise exception 'NOT_FOUND: pieza no existe o no es de cobro por unidad'; end if;
  if v_owner <> auth.uid() then raise exception 'AUTH_REQUIRED'; end if;
  if v_disponibles < p_unidades then
    raise exception 'VALIDATION_ERROR: solo quedan % unidades disponibles de "%"', v_disponibles, v_nombre;
  end if;

  if p_precio_unit is null or p_precio_unit < 0 then
    if v_precio is null then raise exception 'VALIDATION_ERROR: sin precio por unidad definido'; end if;
  else
    v_precio := p_precio_unit;
  end if;

  select valor into v_iva_pct from tarifa where clave = 'iva';
  v_sub := round(v_precio * p_unidades, 2);
  v_iva := case when p_factura then round(v_sub * v_iva_pct, 2) else 0 end;
  v_folio_n := nextval('folio_venta_seq');
  v_folio := 'VT-' || lpad(v_folio_n::text, 3, '0');

  insert into venta (owner_id, folio, fecha, cliente, producto, cantidad, precio_unit,
                     factura, subtotal_q, iva_q, total_q)
    values (auth.uid(), v_folio, coalesce(p_fecha, current_date),
            coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(mostrador)'),
            v_nombre, p_unidades, v_precio, p_factura, v_sub, v_iva, v_sub + v_iva)
    returning * into out_row;

  update cotizacion_pieza set vendidas = vendidas + p_unidades where id = p_pieza_id;
  insert into venta_combo_linea (owner_id, folio_venta, cot_folio, pieza_id, unidades)
    values (auth.uid(), v_folio, p_cot_folio, p_pieza_id, p_unidades);
  return out_row;
end; $$;
revoke execute on function vender_unidad_bandeja from public, anon;
grant execute on function vender_unidad_bandeja to authenticated;

-- ============ registrar combo de piezas ya cotizadas ============
create or replace function registrar_combo(
  p_nombre text, p_lineas jsonb,
  p_precio_unit numeric default null, p_factura boolean default false,
  p_fecha date default null, p_cliente text default null
) returns venta
language plpgsql security definer set search_path = public
as $$
declare v_nombre text; v_linea jsonb; v_folio_v text; v_folio_n int;
        v_total numeric(12,2) := 0; v_iva numeric(12,2); v_iva_pct numeric(12,4);
        v_precio_l numeric(12,2); v_uni int; v_disponibles int; v_sub numeric(12,2); out_row venta;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_nombre is null or length(btrim(p_nombre)) = 0 then
    raise exception 'VALIDATION_ERROR: nombre del combo requerido';
  end if;
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'VALIDATION_ERROR: el combo necesita piezas';
  end if;

  -- validar disponibilidad de cada línea (lock) y computar precio default pieza a pieza
  for v_linea in select jsonb_array_elements(p_lineas) loop
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

  for v_linea in select jsonb_array_elements(p_lineas) loop
    v_uni := coalesce((v_linea->>'unidades')::int, 1);
    update cotizacion_pieza set vendidas = vendidas + v_uni
      where id = (v_linea->>'pieza_id')::uuid;
    insert into venta_combo_linea (owner_id, folio_venta, cot_folio, pieza_id, unidades)
      values (auth.uid(), v_folio_v, v_linea->>'cot_folio', (v_linea->>'pieza_id')::uuid, v_uni);
  end loop;

  return out_row;
end; $$;
revoke execute on function registrar_combo from public, anon;
grant execute on function registrar_combo to authenticated;

-- Anulación de venta de bandeja/combo: devuelve las unidades
create or replace function anular_venta(p_folio text) returns void
language plpgsql security definer set search_path = public
as $$
declare linea record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from venta where folio = p_folio and owner_id = auth.uid() and not anulada) then
    raise exception 'NOT_FOUND: venta no existe o ya anulada';
  end if;
  update venta set anulada = true where folio = p_folio and owner_id = auth.uid();

  -- devolver unidades de bandeja directa y de combos (ambas quedan en venta_combo_linea)
  for linea in select * from venta_combo_linea where folio_venta = p_folio and owner_id = auth.uid() loop
    update cotizacion_pieza set vendidas = greatest(vendidas - linea.unidades, 0)
      where id = linea.pieza_id;
  end loop;
end; $$;
revoke execute on function anular_venta from public, anon;
grant execute on function anular_venta to authenticated;
