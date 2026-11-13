-- Migración 6 — eliminar sobre-cargas viejas (ambigüedad de PostgREST)
-- Deja UNA función por RPC: guardar(19 args) y editar(22 args), ambas con defaults igualables.
do $$
declare
  r record;
  n int;
begin
  for r in
    select p.oid, p.proname,
           coalesce(array_length(p.proargnames, 1), 0) as nargs
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.proname in ('guardar_cotizacion', 'editar_cotizacion')
  loop
    n := r.nargs;
    if (r.proname = 'guardar_cotizacion' and n = 19) or
       (r.proname = 'editar_cotizacion' and n = 22) then
      raise notice 'mantener % (%)', r.proname, n;
      continue;
    end if;
    execute format('drop function %s;', r.oid::regprocedure);
    raise notice 'dropeada % (%)', r.proname, n;
  end loop;
end $$;
