-- Migración 14 — materiales múltiples con costo individual
-- Cada material (ej. "PLA Sunlu", "PLA+ eSUN", "Resina ABS-like") tiene su propio Q/g.
-- El cotizador deja de usar las tarifas globales pla_qg/resina_qg para el material
-- y en su lugar usa el costo_qg del material seleccionado.

alter table material add column if not exists costo_qg numeric(12,4) not null default 0;
alter table cotizacion add column if not exists material_usado text;

-- seed de costos para materiales existentes
update material set costo_qg = 0.27 where nombre = 'Resina Sunlu' and costo_qg = 0;
update material set costo_qg = 0.18 where nombre = 'PLA' and costo_qg = 0;

-- asignar material_usado a cotizaciones históricas
update cotizacion set material_usado = 'Resina Sunlu' where tipo = 'Resina' and material_usado is null;
update cotizacion set material_usado = 'PLA' where tipo = 'PLA' and material_usado is null;

-- vista consumo_material: ahora agrupa por material específico
create or replace view consumo_material with (security_invoker = true) as
  select material_usado as material, 'g'::text as unidad,
         coalesce(sum(gramos), 0) as consumido
    from cotizacion
   where material_usado is not null
   group by material_usado;

-- calcular_componentes_cot v2: acepta costo de material como override
create or replace function calcular_componentes_cot(
  p_gramos numeric, p_tipo text, p_impresora text, p_bandejas int,
  p_horas_impresion numeric, p_horas_mo numeric, p_horas_pintura numeric,
  p_pintado boolean, p_embalaje text, p_factura boolean, p_envio_q numeric,
  p_mat_costo numeric default null
) returns table (
  material_q numeric, maquina_q numeric, mano_obra_q numeric,
  consumibles_q numeric, acabado_q numeric, embalaje_q numeric,
  subtotal_q numeric, margen_q numeric, total_sin_iva_q numeric,
  con_factura_q numeric, total_a_cobrar_q numeric
) language plpgsql stable set search_path = public
as $$
declare
  v_resina numeric(12,4); v_pla numeric(12,4); v_desp numeric(12,4);
  v_mo_h numeric(12,4); v_margen_p numeric(12,4); v_iva numeric(12,4);
  v_cons_b numeric(12,4); v_cons_t numeric(12,4);
  v_primer numeric(12,4); v_barniz numeric(12,4); v_pinturas numeric(12,4);
  v_t4 numeric(12,4); v_t3 numeric(12,4); v_c5 numeric(12,4);
  v_ep numeric(12,4); v_em numeric(12,4); v_eg numeric(12,4);
  v_mat_costo numeric(12,4);
  v_mat numeric(12,2); v_maq numeric(12,2); v_moo numeric(12,2);
  v_cons numeric(12,2); v_acab numeric(12,2); v_emb numeric(12,2);
  v_sub numeric(12,2); v_marg numeric(12,2); v_min numeric(12,2);
  v_tot numeric(12,2); v_cf numeric(12,2); v_cob numeric(12,2);
begin
  select valor into v_resina   from tarifa where clave = 'resina_qg';
  select valor into v_pla      from tarifa where clave = 'pla_qg';
  select valor into v_desp     from tarifa where clave = 'desperdicio';
  select valor into v_mo_h     from tarifa where clave = 'mo_qh';
  select valor into v_margen_p from tarifa where clave = 'margen';
  select valor into v_iva      from tarifa where clave = 'iva';
  select valor into v_cons_b   from tarifa where clave = 'cons_bandeja';
  select valor into v_cons_t   from tarifa where clave = 'cons_trabajo';
  select valor into v_primer   from tarifa where clave = 'primer_qfig';
  select valor into v_barniz   from tarifa where clave = 'barniz_qfig';
  select valor into v_pinturas from tarifa where clave = 'pinturas_qfig';
  select valor into v_t4       from tarifa where clave = 'tarifa_saturn4';
  select valor into v_t3       from tarifa where clave = 'tarifa_saturn3';
  select valor into v_c5       from tarifa where clave = 'tarifa_creator5';
  select valor into v_ep       from tarifa where clave = 'embalaje_pequeña';
  select valor into v_em       from tarifa where clave = 'embalaje_mediana';
  select valor into v_eg       from tarifa where clave = 'embalaje_grande';

  if v_resina is null then raise exception 'VALIDATION_ERROR: faltan tarifas (config incompleta)'; end if;

  -- costo del material: usa el override si se proporciona, si no la tarifa global
  v_mat_costo := case p_tipo when 'Resina' then v_resina else v_pla end;
  if p_mat_costo is not null and p_mat_costo > 0 then
    v_mat_costo := p_mat_costo;
  end if;

  v_mat := round(p_gramos * v_mat_costo * v_desp, 2);
  v_maq := round(p_horas_impresion * (case p_impresora
            when 'Saturn 4' then v_t4 when 'Saturn 3' then v_t3 else v_c5 end), 2);
  v_moo := round((p_horas_mo + p_horas_pintura) * v_mo_h, 2);
  v_cons := case when p_tipo = 'Resina' then round(p_bandejas * v_cons_b + v_cons_t, 2) else 0 end;
  v_acab := case when p_pintado then round(v_primer + v_barniz + v_pinturas, 2) else 0 end;
  v_emb := case p_embalaje
            when 'Pequeña' then v_ep when 'Mediana' then v_em
            when 'Grande' then v_eg else 0 end;

  v_sub  := v_mat + v_maq + v_moo + v_cons + v_acab + v_emb;
  v_marg := round(v_sub * v_margen_p, 2);
  v_min  := v_mat + round(1 * v_mo_h, 2) + v_cons;
  v_tot  := greatest(v_sub + v_marg, v_min);
  v_cf   := round(v_tot * (1 + v_iva), 2);
  v_cob  := (case when p_factura then v_cf else v_tot end) + p_envio_q;

  return query select v_mat, v_maq, v_moo, v_cons, v_acab, v_emb, v_sub, v_marg, v_tot, v_cf, v_cob;
end; $$;

-- guardar_cotizacion v6: acepta y persiste material_usado
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
  p_material text default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_folio_n int; v_folio text; v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record; v_piezas jsonb;
        v_mat_costo numeric(12,4);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_piezas := jsonb_a_array(p_piezas);
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
    if v_piezas is null or jsonb_array_length(v_piezas) = 0 then
      raise exception 'VALIDATION_ERROR: la bandeja necesita al menos una pieza';
    end if;
  end if;

  -- costo del material seleccionado
  v_mat_costo := null;
  if p_material is not null and length(btrim(p_material)) > 0 then
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

-- editar_cotizacion v6: acepta material_usado
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
  p_material text default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_prev numeric(12,2); v_est_bandeja boolean; v_est_metodo text;
        v_unidades int; v_pu numeric(12,2);
        c record; out_row cotizacion; pz record; v_piezas jsonb;
        v_mat_costo numeric(12,4);
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

  v_mat_costo := null;
  if p_material is not null and length(btrim(p_material)) > 0 then
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
      v_mat_costo := null; -- reutilización de variable para evitar conflicto
      declare v_exist_id uuid; v_exist_cant int;
      begin
        select id, cantidad into v_exist_id, v_exist_cant from cotizacion_pieza
         where folio = p_folio and owner_id = auth.uid()
           and (pid is not null and id = pid or (pid is null and nombre = btrim(pz.nombre)));
        if v_exist_id is not null then
          update cotizacion_pieza set nombre = btrim(pz.nombre), cantidad = v_cantidad
           where id = v_exist_id;
        else
          insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
            values (auth.uid(), p_folio, btrim(pz.nombre), v_cantidad);
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
