-- Migración 15 — desglose de gramos por material en cada cotización
-- Permite registrar cuántos gramos de CADA material se usaron (mezclas, multi-material)

create table if not exists cotizacion_material (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  folio text not null,
  material text not null,
  gramos numeric(10,2) not null default 0 check (gramos >= 0),
  foreign key (folio) references cotizacion (folio) on delete cascade
);
create index if not exists cotmat_folio on cotizacion_material (folio);
alter table cotizacion_material enable row level security;
revoke all on cotizacion_material from anon;
create policy "cotmat owner all" on cotizacion_material for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- consumo_material: ahora cada material se descuenta por sus gramos específicos
create or replace view consumo_material with (security_invoker = true) as
  select cm.material, m.unidad,
         coalesce(sum(cm.gramos), 0) as consumido
    from cotizacion_material cm
    join material m on m.nombre = cm.material
   group by cm.material, m.unidad;

-- seed: convertir material_usado existente a filas en cotizacion_material
insert into cotizacion_material (owner_id, folio, material, gramos)
select c.owner_id, c.folio, c.material_usado, c.gramos
  from cotizacion c
 where c.material_usado is not null
   and not exists (select 1 from cotizacion_material cm where cm.folio = c.folio);
