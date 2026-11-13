-- Migración 3 — eliminar cotizaciones, POS solo Confirmadas y precio por unidad editable
-- Ejecutar tras migración 2.

-- ============ vista v2: piezas con estado (para filtrar Confirmadas en el POS) ============
create or replace view piezas_bandeja with (security_invoker = true) as
  select pz.id, pz.folio, pz.nombre, pz.cantidad, pz.vendidas,
         pz.cantidad - pz.vendidas as disponibles,
         ct.precio_venta_unidad, ct.cliente, ct.fecha,
         ct.estado, ct.metodo_cobro
    from cotizacion_pieza pz
    join cotizacion ct on ct.folio = pz.folio
   where ct.metodo_cobro = 'unidad';

-- ============ eliminar cotizacion (v1: sin ventas de sus piezas) ============
create or replace function eliminar_cotizacion(p_folio text) returns void
language plpgsql security definer set search_path = public
as $$
declare v_prods int; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select owner_id into v_owner from cotizacion where folio = p_folio;
  if not found then raise exception 'NOT_FOUND: cotizacion no existe'; end if;
  if v_owner <> auth.uid() then raise exception 'AUTH_REQUIRED'; end if;

  -- protegida: la bandeja ya tiene unidades vendidas (ventas atadas a sus piezas)
  select coalesce(sum(vendidas), 0) into v_prods
    from cotizacion_pieza where folio = p_folio;
  if v_prods > 0 then
    raise exception 'VALIDATION_ERROR: la cotizacion tiene % unidades vendidas; anula esas ventas primero', v_prods;
  end if;

  delete from cotizacion where folio = p_folio and owner_id = auth.uid();
end; $$;
revoke execute on function eliminar_cotizacion from public, anon;
grant execute on function eliminar_cotizacion to authenticated;

-- ============ guardar_cotizacion v3: precio por unidad definible ============
create or replace function guardar_cotizacion(
  p_fecha date default null, p_cliente text default null, p_producto text default null,
  p_tipo text default null, p_impresora text default null, p_bandejas int default 1,
  p_gramos numeric default null, p_horas_impresion numeric default null, p_horas_mo numeric default null,
  p_horas_pintura numeric default 0, p_pintado boolean default false,
  p_embalaje text default 'Ninguno', p_factura boolean default false,
  p_envio_q numeric default 0,
  p_es_bandeja boolean default false,
  p_metodo_cobro text default 'total',
  p_piezas jsonb default null,
  p_precio_venta_unidad numeric default null
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
      if pz.cantidad < 1 then raise exception 'VALIDATION_ERROR: cantidad de pieza >= 1'; end if;
      insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
        values (auth.uid(), v_folio, btrim(pz.nombre), pz.cantidad);
      v_unidades := v_unidades + pz.cantidad;
    end loop;
    if p_metodo_cobro = 'unidad' and v_unidades > 0 then
      v_pu := case
        when p_precio_venta_unidad is not null and p_precio_venta_unidad >= 0
          then round(p_precio_venta_unidad, 2)
        else round(out_row.total_a_cobrar_q / v_unidades, 2)
      end;
      update cotizacion set precio_venta_unidad = v_pu where folio = v_folio;
    end if;
  end if;

  select * into out_row from cotizacion where folio = v_folio and owner_id = auth.uid();
  return out_row;
end; $$;

-- ============ editar_cotizacion v3: incluye precio por unidad manual ============
create or replace function editar_cotizacion(
  p_folio text, p_fecha date, p_cliente text, p_producto text,
  p_tipo text, p_impresora text, p_bandejas int,
  p_gramos numeric, p_horas_impresion numeric, p_horas_mo numeric,
  p_horas_pintura numeric, p_pintado boolean, p_embalaje text,
  p_factura boolean, p_envio_q numeric, p_estado text,
  p_notas text default null,
  p_es_bandeja boolean default null,
  p_metodo_cobro text default null,
  p_piezas jsonb default null,
  p_precio_venta_unidad numeric default null
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
      v_pu := case
        when p_precio_venta_unidad is not null and p_precio_venta_unidad >= 0
          then round(p_precio_venta_unidad, 2)
        else round(out_row.total_a_cobrar_q / v_unidades, 2)
      end;
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

-- v2 view saldo_material: expone stock_inicial (necesario para el edito inline del Inventario)
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
         as saldo
    from material m;
