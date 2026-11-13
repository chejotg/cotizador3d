-- Migración 9 — editar piezas CONSERVANDO id y vendidas (no borrar/recrear)
-- Reglas:
--  · piezas con id → UPDATE (nombre/cantidad); vendidas se conserva desde DB (fuente de verdad)
--  · piezas nuevas (sin id ni nombre existente) → INSERT con vendidas = 0
--  · piezas que desaparecen del formulario → solo se borran si vendidas = 0
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
  p_bandejas_detalle jsonb default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_prev numeric(12,2); v_est_bandeja boolean; v_est_metodo text;
        v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion;
        v_piezas jsonb; v_linea jsonb; v_nombre text; v_cantidad int;
        v_pieza_id uuid; v_existe_vendidas int; v_existe_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_piezas := jsonb_a_array(p_piezas);
  select total_a_cobrar_q, es_bandeja, metodo_cobro into v_prev, v_est_bandeja, v_est_metodo
    from cotizacion where folio = p_folio and owner_id = auth.uid();
  if not found then raise exception 'NOT_FOUND: cotizacion no existe'; end if;

  if p_es_bandeja is not null then v_est_bandeja := p_es_bandeja; end if;
  if p_metodo_cobro is not null then v_est_metodo := p_metodo_cobro; end if;
  if v_est_bandeja then
    if v_piezas is null then raise exception 'VALIDATION_ERROR: la bandeja necesita sus piezas'; end if;
    if jsonb_array_length(v_piezas) = 0 then raise exception 'VALIDATION_ERROR: al menos una pieza'; end if;
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
    bandejas_detalle = jsonb_a_array(p_bandejas_detalle),
    hist_total_previo = v_prev,
    material_q = c.material_q, maquina_q = c.maquina_q,
    mano_obra_q = c.mano_obra_q, consumibles_q = c.consumibles_q,
    acabado_q = c.acabado_q, embalaje_q = c.embalaje_q,
    subtotal_q = c.subtotal_q, margen_q = c.margen_q,
    total_sin_iva_q = c.total_sin_iva_q, con_factura_q = c.con_factura_q,
    total_a_cobrar_q = c.total_a_cobrar_q
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;

  -- PIEZAS: upsert conservando id y vendidas; borrar solo las quitadas SIN ventas
  if v_est_bandeja and v_piezas is not null then
    v_unidades := 0;
    for v_linea in select jsonb_array_elements(v_piezas) loop
      v_nombre := btrim(coalesce(v_linea->>'nombre', ''));
      v_cantidad := greatest(coalesce((v_linea->>'cantidad')::int, 1), 1);
      v_pieza_id := nullif(v_linea->>'pieza_id', '')::uuid;
      if v_nombre = '' then
        raise exception 'VALIDATION_ERROR: pieza sin nombre en la bandeja';
      end if;

      v_existe_id := null; v_existe_vendidas := 0;
      if v_pieza_id is not null then
        select id, vendidas into v_existe_id, v_existe_vendidas
          from cotizacion_pieza
         where id = v_pieza_id and folio = p_folio and owner_id = auth.uid();
      end if;
      if v_existe_id is null then
        select id, vendidas into v_existe_id, v_existe_vendidas
          from cotizacion_pieza
         where folio = p_folio and owner_id = auth.uid() and nombre = v_nombre;
      end if;

      if v_existe_id is not null then
        update cotizacion_pieza
           set nombre = v_nombre, cantidad = v_cantidad
         where id = v_existe_id;
      else
        insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
          values (auth.uid(), p_folio, v_nombre, v_cantidad);
      end if;
      v_unidades := v_unidades + v_cantidad;
    end loop;

    -- borrar solo las piezas que ya no están y que no tengan ventas
    delete from cotizacion_pieza qz
     where qz.folio = p_folio and qz.owner_id = auth.uid()
       and qz.vendidas = 0
       and not exists (
         select 1 from jsonb_array_elements(v_piezas) j
          where btrim(coalesce(j->>'nombre','')) = qz.nombre
             or (j->>'pieza_id')::uuid = qz.id
       );
    -- las que sí tienen ventas pero (imposible llegar aquí sin estar en la lista)... no tocar

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
    delete from cotizacion_pieza qz
     where qz.folio = p_folio and qz.owner_id = auth.uid() and qz.vendidas = 0;
  end if;

  select * into out_row from cotizacion where folio = p_folio and owner_id = auth.uid();
  return out_row;
end; $$;


