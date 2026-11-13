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
        c record; out_row cotizacion; lpz record; v_piezas jsonb;
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
    delete from cotizacion_pieza cpz
     where cpz.folio = p_folio and cpz.owner_id = auth.uid() and cpz.vendidas = 0
        and not exists (
          select 1 from jsonb_array_elements(v_piezas) j
           where btrim(coalesce(j->>'nombre','')) = cpz.nombre
              or (j->>'pieza_id')::uuid = cpz.id
        );
    v_unidades := 0;
    for lpz in select j->>'nombre' as nombre, coalesce((j->>'cantidad')::int, 1) as cantidad,
                     (j->>'pieza_id')::uuid as pid
              from jsonb_array_elements(v_piezas) as j
    loop
      declare v_exist_id uuid; v_pid uuid;
      begin
        v_pid := lpz.pid;
        select id into v_exist_id from cotizacion_pieza
         where folio = p_folio and owner_id = auth.uid()
           and (v_pid is not null and id = v_pid or (v_pid is null and nombre = btrim(lpz.nombre)));
        if v_exist_id is not null then
          update cotizacion_pieza set nombre = btrim(lpz.nombre), cantidad = greatest(lpz.cantidad, 1)
           where id = v_exist_id;
        else
          insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
            values (auth.uid(), p_folio, btrim(lpz.nombre), greatest(lpz.cantidad, 1));
        end if;
      end;
      v_unidades := v_unidades + greatest(lpz.cantidad, 1);
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
    delete from cotizacion_pieza cpz
     where cpz.folio = p_folio and cpz.owner_id = auth.uid() and cpz.vendidas = 0;
  end if;

  select * into out_row from cotizacion where folio = p_folio and owner_id = auth.uid();
  return out_row;
end; $$;



