-- Migración v1 — Cotizador Web (Spec Kit 001-cotizador-web)
-- Ejecutar COMPLETO en el SQL Editor de Supabase. Deny-by-default.

-- ============ Secuencias de folios ============
-- seed.sql ajustara el contador a 19 tras insertar COT-001..018
create sequence if not exists folio_cotizacion_seq start 1 cache 1;
create sequence if not exists folio_venta_seq start 1;

-- ============ tarifa (config del negocio) ============
create table if not exists tarifa (
  clave text primary key,
  valor numeric(12,4) not null check (valor > 0),
  unidad text,
  nota text,
  updated_at timestamptz not null default now()
);
alter table tarifa enable row level security;
revoke all on tarifa from anon;
grant select, update on tarifa to authenticated;
create policy "tarifa read" on tarifa for select to authenticated using (true);
create policy "tarifa update" on tarifa for update to authenticated
  using (true) with check (true);

-- ============ cotizacion ============
create table if not exists cotizacion (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  folio text unique,
  fecha date not null default current_date,
  cliente text not null default '(por definir)',
  producto text not null,
  tipo text not null check (tipo in ('Resina','PLA')),
  impresora text not null check (impresora in ('Saturn 4','Saturn 3','Creator 5')),
  bandejas int not null default 1 check (bandejas >= 1),
  gramos numeric(10,2) not null check (gramos >= 0),
  horas_impresion numeric(10,2) not null check (horas_impresion >= 0),
  horas_mo numeric(10,2) not null check (horas_mo >= 0),
  horas_pintura numeric(10,2) not null default 0 check (horas_pintura >= 0),
  pintado boolean not null default false,
  embalaje text not null default 'Ninguno' check (embalaje in ('Ninguno','Pequeña','Mediana','Grande')),
  factura boolean not null default false,
  envio_q numeric(12,2) not null default 0 check (envio_q >= 0),
  estado text not null default 'Emitida' check (estado in ('Emitida','Confirmada','Entregada','Cancelada')),
  precio_venta_final numeric(12,2),
  hist_total_previo numeric(12,2),
  notas text,
  -- snapshot (llenan los RPC)
  material_q numeric(12,2), maquina_q numeric(12,2), mano_obra_q numeric(12,2),
  consumibles_q numeric(12,2), acabado_q numeric(12,2), embalaje_q numeric(12,2),
  subtotal_q numeric(12,2), margen_q numeric(12,2), total_sin_iva_q numeric(12,2),
  con_factura_q numeric(12,2), total_a_cobrar_q numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists cotizacion_owner on cotizacion (owner_id);
create index if not exists cotizacion_folio on cotizacion (folio);
alter table cotizacion enable row level security;
revoke all on cotizacion from anon;
create policy "cotizacion owner all" on cotizacion for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ material ============
create table if not exists material (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  nombre text not null,
  unidad text not null,
  descontable_por text check (descontable_por in ('pla','resina')),
  stock_inicial numeric(12,2) not null default 0,
  minimo numeric(12,2) not null default 0,
  unique (owner_id, nombre)
);
create index if not exists material_owner on material (owner_id);
alter table material enable row level security;
revoke all on material from anon;
create policy "material owner all" on material for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ movimiento_material ============
create table if not exists movimiento_material (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  fecha date not null default current_date,
  material text not null,
  entrada numeric(12,2) not null default 0 check (entrada >= 0),
  salida numeric(12,2) not null default 0 check (salida >= 0),
  nota text
);
create index if not exists movmat_owner on movimiento_material (owner_id);
alter table movimiento_material enable row level security;
revoke all on movimiento_material from anon;
create policy "movmat owner all" on movimiento_material for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ producto (catalogo / piezas terminadas) ============
create table if not exists producto (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  nombre text not null,
  precio_sin_iva numeric(12,2) not null check (precio_sin_iva >= 0),
  nota text,
  stock_inicial int not null default 0,
  minimo int not null default 0,
  unique (owner_id, nombre)
);
create index if not exists producto_owner on producto (owner_id);
alter table producto enable row level security;
revoke all on producto from anon;
create policy "producto owner all" on producto for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ movimiento_producto ============
create table if not exists movimiento_producto (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  fecha date not null default current_date,
  producto text not null,
  entrada int not null default 0 check (entrada >= 0),
  salida int not null default 0 check (salida >= 0),
  nota text
);
create index if not exists movprod_owner on movimiento_producto (owner_id);
alter table movimiento_producto enable row level security;
revoke all on movimiento_producto from anon;
create policy "movprod owner all" on movimiento_producto for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ venta ============
create table if not exists venta (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  folio text unique,
  fecha date not null default current_date,
  cliente text not null default '(mostrador)',
  producto text not null,
  cantidad int not null default 1 check (cantidad >= 1),
  precio_unit numeric(12,2) not null check (precio_unit >= 0),
  factura boolean not null default false,
  anulada boolean not null default false,
  subtotal_q numeric(12,2), iva_q numeric(12,2), total_q numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists venta_owner on venta (owner_id);
create index if not exists venta_fecha on venta (fecha);
alter table venta enable row level security;
revoke all on venta from anon;
create policy "venta owner all" on venta for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- ============ Vistas derivadas ============
create or replace view consumo_material with (security_invoker = true) as
  select 'PLA'::text as material, 'g'::text as unidad,
         coalesce(sum(gramos) filter (where tipo = 'PLA'), 0) as consumido
    from cotizacion
  union all
  select 'Resina Sunlu', 'g',
         coalesce(sum(gramos) filter (where tipo = 'Resina'), 0)
    from cotizacion;

create or replace view saldo_material with (security_invoker = true) as
  select m.nombre, m.unidad, m.minimo, m.descontable_por,
         m.stock_inicial
           + coalesce((select sum(mm.entrada) from movimiento_material mm
                        where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
           - coalesce((select sum(cm.consumido) from consumo_material cm
                        where cm.material = m.nombre and m.descontable_por is not null
                        and cm.unidad = m.unidad), 0)
           - coalesce((select sum(mm.salida) from movimiento_material mm
                        where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
         as saldo,
         case when m.minimo > 0
              and m.stock_inicial
                      + coalesce((select sum(mm.entrada) from movimiento_material mm
                                   where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
                      - coalesce((select sum(cm.consumido) from consumo_material cm
                                   where cm.material = m.nombre and m.descontable_por is not null
                                   and cm.unidad = m.unidad), 0)
                      - coalesce((select sum(mm.salida) from movimiento_material mm
                                   where mm.material = m.nombre and mm.owner_id = m.owner_id), 0)
                 <= m.minimo
              then 'REPOSICION' else 'ok' end as alerta
    from material m;

create or replace view saldo_producto with (security_invoker = true) as
  select p.nombre, p.minimo,
         p.stock_inicial
           + coalesce((select sum(mp.entrada) from movimiento_producto mp
                        where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
           - coalesce((select sum(v.cantidad) from venta v
                        where v.producto = p.nombre and v.owner_id = p.owner_id
                        and not v.anulada), 0)
           - coalesce((select sum(mp.salida) from movimiento_producto mp
                        where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
         as saldo,
         case when p.minimo > 0
              and p.stock_inicial
                      + coalesce((select sum(mp.entrada) from movimiento_producto mp
                                   where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
                      - coalesce((select sum(v.cantidad) from venta v
                                   where v.producto = p.nombre and v.owner_id = p.owner_id
                                   and not v.anulada), 0)
                      - coalesce((select sum(mp.salida) from movimiento_producto mp
                                   where mp.producto = p.nombre and mp.owner_id = p.owner_id), 0)
                 <= p.minimo
              then 'REPOSICION' else 'ok' end as alerta
    from producto p;

-- ============ CÁLCULO compartido (constitución I: tarifas viven en DB) ============
-- Redondeo postgres round(x,2) = half-up para positivos (paridad con Excel).
create or replace function calcular_componentes_cot(
  p_gramos numeric, p_tipo text, p_impresora text, p_bandejas int,
  p_horas_impresion numeric, p_horas_mo numeric, p_horas_pintura numeric,
  p_pintado boolean, p_embalaje text, p_factura boolean, p_envio_q numeric
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

  -- material (regla del negocio: gramos × precio g × factor desperdicio 1.10)
  v_mat := round(p_gramos * (case p_tipo when 'Resina' then v_resina else v_pla end) * v_desp, 2);
  -- máquina (tarifa por impresora)
  v_maq := round(p_horas_impresion * (case p_impresora
            when 'Saturn 4' then v_t4 when 'Saturn 3' then v_t3 else v_c5 end), 2);
  -- mano de obra Q28/h (impresión manual + pintura)
  v_moo := round((p_horas_mo + p_horas_pintura) * v_mo_h, 2);
  -- consumibles solo MSLA (IPA+FEP+guantes por bandeja + guantes postproceso)
  v_cons := case when p_tipo = 'Resina' then round(p_bandejas * v_cons_b + v_cons_t, 2) else 0 end;
  -- acabado solo pintado (tarifas vigentes de figura grande; mediano/pequeño por definir)
  v_acab := case when p_pintado then round(v_primer + v_barniz + v_pinturas, 2) else 0 end;
  -- embalaje por categoría (0 si 'Ninguno' = entrega en mano)
  v_emb := case p_embalaje
            when 'Pequeña' then v_ep when 'Mediana' then v_em
            when 'Grande' then v_eg else 0 end;

  v_sub  := v_mat + v_maq + v_moo + v_cons + v_acab + v_emb;
  v_marg := round(v_sub * v_margen_p, 2);
  -- REGLA 10 negocio.md: piso de cobro mínimol — nunca menos que material + 1 h MO + consumibles
  v_min  := v_mat + round(1 * v_mo_h, 2) + v_cons;
  v_tot  := greatest(v_sub + v_marg, v_min);
  v_cf   := round(v_tot * (1 + v_iva), 2);
  v_cob  := (case when p_factura then v_cf else v_tot end) + p_envio_q;

  return query select v_mat, v_maq, v_moo, v_cons, v_acab, v_emb, v_sub, v_marg, v_tot, v_cf, v_cob;
end; $$;

-- ============ RPCs (revoke amplio + solo authenticated) ============
create or replace function guardar_cotizacion(
  p_fecha date default null, p_cliente text default null, p_producto text default null,
  p_tipo text default null, p_impresora text default null, p_bandejas int default 1,
  p_gramos numeric default null, p_horas_impresion numeric default null, p_horas_mo numeric default null,
  p_horas_pintura numeric default 0, p_pintado boolean default false,
  p_embalaje text default 'Ninguno', p_factura boolean default false,
  p_envio_q numeric default 0
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_folio_n int; v_folio text;
        c record; out_row cotizacion;
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

  select * into c from calcular_componentes_cot(
    p_gramos, p_tipo, p_impresora, p_bandejas, p_horas_impresion,
    p_horas_mo, p_horas_pintura, p_pintado, p_embalaje, p_factura, p_envio_q);

  v_folio_n := nextval('folio_cotizacion_seq');
  v_folio := 'COT-' || lpad(v_folio_n::text, 3, '0');

  insert into cotizacion (owner_id, folio, fecha, cliente, producto, tipo, impresora,
    bandejas, gramos, horas_impresion, horas_mo, horas_pintura, pintado, embalaje,
    factura, envio_q,
    material_q, maquina_q, mano_obra_q, consumibles_q, acabado_q, embalaje_q,
    subtotal_q, margen_q, total_sin_iva_q, con_factura_q, total_a_cobrar_q)
  values (auth.uid(), v_folio,
          coalesce(p_fecha, current_date),
          coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(por definir)'),
          btrim(p_producto), p_tipo, p_impresora,
          p_bandejas, p_gramos, p_horas_impresion, p_horas_mo, p_horas_pintura,
          p_pintado, p_embalaje, p_factura, p_envio_q,
          c.material_q, c.maquina_q, c.mano_obra_q, c.consumibles_q, c.acabado_q,
          c.embalaje_q, c.subtotal_q, c.margen_q, c.total_sin_iva_q,
          c.con_factura_q, c.total_a_cobrar_q)
  returning * into out_row;
  return out_row;
end; $$;
revoke execute on function guardar_cotizacion from public, anon;
grant execute on function guardar_cotizacion to authenticated;

create or replace function editar_cotizacion(
  p_folio text, p_fecha date, p_cliente text, p_producto text,
  p_tipo text, p_impresora text, p_bandejas int,
  p_gramos numeric, p_horas_impresion numeric, p_horas_mo numeric,
  p_horas_pintura numeric, p_pintado boolean, p_embalaje text,
  p_factura boolean, p_envio_q numeric, p_estado text,
  p_notas text default null
) returns cotizacion
language plpgsql security definer set search_path = public
as $$
declare v_prev numeric(12,2); c record; out_row cotizacion;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select total_a_cobrar_q into v_prev
    from cotizacion where folio = p_folio and owner_id = auth.uid();
  if not found then raise exception 'NOT_FOUND: cotizacion no existe'; end if;

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
    hist_total_previo = v_prev,
    material_q = c.material_q, maquina_q = c.maquina_q,
    mano_obra_q = c.mano_obra_q, consumibles_q = c.consumibles_q,
    acabado_q = c.acabado_q, embalaje_q = c.embalaje_q,
    subtotal_q = c.subtotal_q, margen_q = c.margen_q,
    total_sin_iva_q = c.total_sin_iva_q, con_factura_q = c.con_factura_q,
    total_a_cobrar_q = c.total_a_cobrar_q
  where folio = p_folio and owner_id = auth.uid()
  returning * into out_row;
  return out_row;
end; $$;
revoke execute on function editar_cotizacion from public, anon;
grant execute on function editar_cotizacion to authenticated;

create or replace function registrar_venta(
  p_fecha date default null, p_cliente text default null,
  p_producto text default null, p_cantidad int default 1,
  p_precio_unit numeric default null, p_factura boolean default false
) returns venta
language plpgsql security definer set search_path = public
as $$
declare v_precio numeric(12,2); v_sub numeric(12,2); v_iva numeric(12,2);
        v_iva_pct numeric(12,4); v_folio_n int; v_folio text; out_row venta;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_producto is null or length(btrim(p_producto)) = 0 then
    raise exception 'VALIDATION_ERROR: producto requerido';
  end if;
  if p_cantidad < 1 then raise exception 'VALIDATION_ERROR: cantidad >= 1'; end if;
  if p_precio_unit is null or p_precio_unit < 0 then
    select precio_sin_iva into v_precio from producto
     where nombre = p_producto and owner_id = auth.uid();
    if v_precio is null then raise exception 'NOT_FOUND: producto no existe'; end if;
  else
    v_precio := p_precio_unit;
  end if;
  select valor into v_iva_pct from tarifa where clave = 'iva';
  if v_iva_pct is null then raise exception 'VALIDATION_ERROR: falta tarifa iva'; end if;
  v_sub := round(v_precio * p_cantidad, 2);
  v_iva := case when p_factura then round(v_sub * v_iva_pct, 2) else 0 end;
  v_folio_n := nextval('folio_venta_seq');
  v_folio := 'VT-' || lpad(v_folio_n::text, 3, '0');
  insert into venta (owner_id, folio, fecha, cliente, producto, cantidad,
                     precio_unit, factura, subtotal_q, iva_q, total_q)
    values (auth.uid(), v_folio, coalesce(p_fecha, current_date),
            coalesce(nullif(btrim(coalesce(p_cliente,'')), ''), '(mostrador)'),
            p_producto, p_cantidad, v_precio, p_factura, v_sub, v_iva, v_sub + v_iva)
    returning * into out_row;
  return out_row;
end; $$;
revoke execute on function registrar_venta from public, anon;
grant execute on function registrar_venta to authenticated;

create or replace function anular_venta(p_folio text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update venta set anulada = true
   where folio = p_folio and owner_id = auth.uid() and not anulada;
  if not found then raise exception 'NOT_FOUND: venta no existe o ya anulada'; end if;
  -- las piezas vuelven solas al saldo: la vista excluye anuladas
end; $$;
revoke execute on function anular_venta from public, anon;
grant execute on function anular_venta to authenticated;

