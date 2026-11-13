-- Migración 15b — RPCs aceptan p_materiales jsonb (desglose por material)
-- Cada elemento: {"material": "PLA", "gramos": 100}
-- El costo de material = Σ (gramos_i × costo_qg_i) × desperdicio
-- El stock se descuenta por material específico

-- guardar_cotizacion v7
drop function if exists guardar_cotizacion(date, text, text, text, text, int, numeric, numeric, numeric, numeric, boolean, text, boolean, numeric, boolean, text, jsonb, numeric, jsonb, text);
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
  p_precio_venta_unidad numeric default null,
  p_bandejas_detalle jsonb default null,
  p_material text default null,
  p_materiales jsonb default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_folio_n int; v_folio text; v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record; v_piezas jsonb;
        v_mat_costo numeric(12,4); v_materiales jsonb; ml record; v_g_total numeric(12,2) := 0; v_c_total numeric(12,4) := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_piezas := jsonb_a_array(p_piezas);
  v_materiales := jsonb_a_array(p_materiales);
  if p_producto is null or length(btrim(p_producto)) = 0 then
    raise exception 'VALIDATION_ERROR: producto requerido';
  end if;
  if p_tipo = 'PLA' and p_impresora <> 'Creator 5' then
    raise exception 'VALIDATION_ERROR: tipo PLA solo con Creator 5';
  end if;
  if p_tipo = 'Resina' and p_impresora in ('Creator 5') then
    raise exception 'VALIDATION_ERROR: tipo Resina con Saturn 4 o Saturn 3';
  end if;

  -- costo de material: mezcla ponderada desde el desglose de materiales
  v_mat_costo := null;
  if v_materiales is not null and jsonb_array_length(v_materiales) > 0 then
    for ml in select j->>'material' as material, coalesce((j->>'gramos')::numeric, 0) as gramos
              from jsonb_array_elements(v_materiales) as j
    loop
      declare mc numeric(12,4);
      begin
        select costo_qg into mc from material
         where nombre = ml.material and owner_id = auth.uid();
        v_g_total := v_g_total + ml.gramos;
        v_c_total := v_c_total + ml.gramos * coalesce(mc, 0);
      end;
    end loop;
    if v_g_total > 0 then
      v_mat_costo := v_c_total / v_g_total; -- costo promedio ponderado por gramo
    end if;
  elsif p_material is not null and length(btrim(p_material)) > 0 then
    select costo_qg into v_mat_costo from material
     where nombre = p_material and owner_id = auth.uid() and costo_qg > 0;
  end if;

  select * into c from calcular_componentes_cot(
    p_gramos, p_tipo, p_impresora, p_bandejas, p_horas_impresion,
    p_horas_mo, p_horas_pintura, p_pintado, p_embalaje, p_factura, p_envio_q,
    v_mat_costo);

  v_folio_n := nextval('folio_cotizacion_seq');
  v_folio := 'COT-' || lpad(v_folio_n::text, 3, '0');

  insert into cotizacion (owner_id, folio, fecha, cliente, producto, tipo, impresora,
    bandejas, gramos, horas_impresion, horas_mo, horas_pintura, pintado, embalaje,
    factura, envio_q, es_bandeja, metodo_cobro, bandejas_detalle, material_usado,
    material_q, maquina_q, mano_obra_q, consumibles_q, acabado_q, embalaje_q,
    subtotal_q, margen_q, total_sin_iva_q, con_factura_q, total_a_cobrar_q)
  values (auth.uid(), v_folio,
          coalesce(p_fecha, current_date),
          coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(por definir)'),
          btrim(p_producto), p_tipo, p_impresora,
          p_bandejas, p_gramos, p_horas_impresion, p_horas_mo, p_horas_pintura,
          p_pintado, p_embalaje, p_factura, p_envio_q,
          p_es_bandeja, case when p_es_bandeja then p_metodo_cobro else 'total' end,
          jsonb_a_array(p_bandejas_detalle),
          coalesce(nullif(btrim(coalesce(p_material,'')), ''), case p_tipo when 'Resina' then 'Resina Sunlu' else 'PLA' end),
          c.material_q, c.maquina_q, c.mano_obra_q, c.consumibles_q, c.acabado_q,
          c.embalaje_q, c.subtotal_q, c.margen_q, c.total_sin_iva_q,
          c.con_factura_q, c.total_a_cobrar_q)
  returning * into out_row;

  -- insertar desglose de materiales
  if v_materiales is not null and jsonb_array_length(v_materiales) > 0 then
    for ml in select j->>'material' as material, coalesce((j->>'gramos')::numeric, 0) as gramos
              from jsonb_array_elements(v_materiales) as j
    loop
      if btrim(coalesce(ml.material,'')) <> '' and ml.gramos > 0 then
        insert into cotizacion_material (owner_id, folio, material, gramos)
          values (auth.uid(), v_folio, btrim(ml.material), ml.gramos);
      end if;
    end loop;
  end if;

  if p_es_bandeja then
    v_unidades := 0;
    for pz in select j->>'nombre' as nombre, coalesce((j->>'cantidad')::int, 1) as cantidad
              from jsonb_array_elements(v_piezas) as j
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

-- editar_cotizacion v7
drop function if exists editar_cotizacion(text, date, text, text, text, text, int, numeric, numeric, numeric, numeric, boolean, text, boolean, numeric, text, text, boolean, text, jsonb, numeric, jsonb, text);
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
  p_precio_venta_unidad numeric default null,
  p_bandejas_detalle jsonb default null,
  p_material text default null,
  p_materiales jsonb default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_prev numeric(12,2); v_est_bandeja boolean; v_est_metodo text;
        v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record; v_piezas jsonb;
        v_mat_costo numeric(12,4); v_materiales jsonb; ml record;
        v_g_total numeric(12,2) := 0; v_c_total numeric(12,4) := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_piezas := jsonb_a_array(p_piezas);
  v_materiales := jsonb_a_array(p_materiales);
  select total_a_cobrar_q, es_bandeja, metodo_cobro into v_prev, v_est_bandeja, v_est_metodo
    from cotizacion where folio = p_folio and owner_id = auth.uid();
  if not found then raise exception 'NOT_FOUND: cotizacion no existe'; end if;

  if p_es_bandeja is not null then v_est_bandeja := p_es_bandeja; end if;
  if p_metodo_cobro is not null then v_est_metodo := p_metodo_cobro; end if;
  if v_est_bandeja then
    if v_piezas is null then raise exception 'VALIDATION_ERROR: la bandeja necesita sus piezas'; end if;
    if jsonb_array_length(v_piezas) = 0 then raise exception 'VALIDATION_ERROR: al menos una pieza'; end if;
  end if;

  v_mat_costo := null;
  if v_materiales is not null and jsonb_array_length(v_materiales) > 0 then
    for ml in select j->>'material' as material, coalesce((j->>'gramos')::numeric, 0) as gramos
              from jsonb_array_elements(v_materiales) as j
    loop
      declare mc numeric(12,4);
      begin
        select costo_qg into mc from material
         where nombre = ml.material and owner_id = auth.uid();
        v_g_total := v_g_total + ml.gramos;
        v_c_total := v_c_total + ml.gramos * coalesce(mc, 0);
      end;
    end loop;
    if v_g_total > 0 then
      v_mat_costo := v_c_total / v_g_total;
    end if;
  elsif p_material is not null and length(btrim(p_material)) > 0 then
    select costo_qg into v_mat_costo from material
     where nombre = p_material and owner_id = auth.uid() and costo_qg > 0;
  end if;

  select * into c from calcular_componentes_cot(
    p_gramos, p_tipo, p_impresora, p_bandejas, p_horas_impresion,
    p_horas_mo, p_horas_pintura, p_pintado, p_embalaje, p_factura, p_envio_q,
    v_mat_costo);

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
    bandejas_detalle = jsonb_a_array(p_bandejas_detalle),
    material_usado = coalesce(nullif(btrim(coalesce(p_material,'')), ''), material_usado),
    hist_total_previo = v_prev,
    material_q = c.material_q, maquina_q = c.maquina_q,
    mano_obra_q = c.mano_obra_q, consumibles_q = c.consumibles_q,
    acabado_q = c.acabado_q, embalaje_q = c.embalaje_q,
    subtotal_q = c.subtotal_q, margen_q = c.margen_q,
    total_sin_iva_q = c.total_sin_iva_q, con_factura_q = c.con_factura_q,
    total_a_cobrar_q = c.total_a_cobrar_q
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;

  -- reemplazar desglose de materiales
  if v_materiales is not null and jsonb_array_length(v_materiales) > 0 then
    delete from cotizacion_material where folio = p_folio and owner_id = auth.uid();
    for ml in select j->>'material' as material, coalesce((j->>'gramos')::numeric, 0) as gramos
              from jsonb_array_elements(v_materiales) as j
    loop
      if btrim(coalesce(ml.material,'')) <> '' and ml.gramos > 0 then
        insert into cotizacion_material (owner_id, folio, material, gramos)
          values (auth.uid(), p_folio, btrim(ml.material), ml.gramos);
      end if;
    end loop;
  end if;

  if v_est_bandeja and v_piezas is not null then
    delete from cotizacion_pieza pz
     where pz.folio = p_folio and pz.owner_id = auth.uid() and pz.vendidas = 0
       and not exists (
         select 1 from jsonb_array_elements(v_piezas) j
          where btrim(coalesce(j->>'nombre','')) = pz.nombre
             or (j->>'pieza_id')::uuid = pz.id
       );
    v_unidades := 0;
    for pz in select j->>'nombre' as nombre, coalesce((j->>'cantidad')::int, 1) as cantidad,
                     (j->>'pieza_id')::uuid as pid
              from jsonb_array_elements(v_piezas) as j
    loop
      declare v_exist_id uuid;
      begin
        select id into v_exist_id from cotizacion_pieza
         where folio = p_folio and owner_id = auth.uid()
           and (pid is not null and id = pid or (pid is null and nombre = btrim(pz.nombre)));
        if v_exist_id is not null then
          update cotizacion_pieza set nombre = btrim(pz.nombre), cantidad = greatest(pz.cantidad, 1)
           where id = v_exist_id;
        else
          insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
            values (auth.uid(), p_folio, btrim(pz.nombre), greatest(pz.cantidad, 1));
        end if;
      end;
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
    delete from cotizacion_pieza pz
     where pz.folio = p_folio and pz.owner_id = auth.uid() and pz.vendidas = 0;
  end if;

  select * into out_row from cotizacion where folio = p_folio and owner_id = auth.uid();
  return out_row;
end; $$;
