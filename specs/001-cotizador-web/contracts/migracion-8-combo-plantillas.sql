-- Migración 8 — plantillas de combo (venta rápida de combos)
create table if not exists combo_guardado (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  nombre text not null,
  nota text,
  lineas jsonb not null,          -- [{cot_folio, pieza_id, unidades}] igual que registrar_combo
  precio numeric(12,2),           -- null = se recalcula con los precios por unidad vigentes
  created_at timestamptz not null default now(),
  unique (owner_id, nombre)
);
alter table combo_guardado enable row level security;
revoke all on combo_guardado from anon;
create policy "combo_guardado owner all" on combo_guardado for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
