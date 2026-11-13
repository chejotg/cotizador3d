// Auditoría de seguridad v2 — verifica que todo esté cerrado
import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

let issues = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? "✓" : "⚠⚠⚠"} ${name} — ${detail}`);
  if (!ok) issues++;
}

// 1. RLS ON en todas las tablas
console.log("\n── RLS EN TABLAS ──");
const rls = await client.query(`select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename`);
for (const t of rls.rows) check(t.tablename, t.rowsecurity, t.rowsecurity ? "RLS ON" : "RLS OFF ⚠⚠⚠");

// 2. Políticas: solo authenticated (nunca anon)
console.log("\n── POLÍTICAS (solo authenticated) ──");
const pols = await client.query(`select tablename, policyname, roles::text as roles from pg_policies where schemaname='public'`);
const conAnon = pols.rows.filter((p) => p.roles?.includes("anon"));
check("políticas sin anon", conAnon.length === 0, conAnon.length === 0 ? "0 políticas con anon ✓" : `${conAnon.length} políticas con anon ⚠⚠⚠`);

// 3. Grants de anon: ninguna tabla o vista
console.log("\n── GRANTS ANON (deben ser 0) ──");
const anonGrants = await client.query(`
  select table_name from information_schema.table_privileges
   where table_schema='public' and grantee='anon'
   group by table_name
`);
check("anon grants", anonGrants.rows.length === 0, anonGrants.rows.length === 0 ? "0 grants para anon ✓" : `${anonGrants.rows.length} tablas/vistas con grants anon ⚠⚠⚠`);

// 4. RPCs: anon no puede ejecutar
console.log("\n── RPCs (anon no puede ejecutar) ──");
const rpcAnon = await client.query(`
  select p.proname, has_function_privilege('anon', p.oid, 'execute') as can_exec
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
     'guardar_cotizacion','editar_cotizacion','registrar_venta',
     'registrar_combo','vender_unidad_bandeja','anular_venta',
     'eliminar_cotizacion','eliminar_venta','actualizar_pedido',
     'jsonb_a_array','calcular_componentes_cot','crear_producto_on_confirm'
   )
`);
const anonExec = rpcAnon.rows.filter((r) => r.can_exec);
check("RPCs anon", anonExec.length === 0, anonExec.length === 0 ? "0 RPCs ejecutables por anon ✓" : `${anonExec.length} RPCs ejecutables por anon ⚠⚠⚠`);

// 5. Views con security_invoker
console.log("\n── VISTAS (security_invoker) ──");
const views = await client.query(`
  select v.viewname,
         coalesce((select t.option_value from pg_options_to_table(c.reloptions) t where t.option_name='security_invoker'), 'false') as sec_inv
    from pg_views v
    join pg_class c on c.relname = v.viewname and c.relnamespace = (select oid from pg_namespace where nspname='public')
   where v.schemaname='public'
`);
for (const v of views.rows) {
  check(v.viewname, v.sec_inv === "true", `security_invoker=${v.sec_inv}`);
}

// 6. Auth: un solo usuario confirmado
console.log("\n── AUTH ──");
const users = await client.query(`select email, email_confirmed_at is not null as ok from auth.users`);
for (const u of users.rows) {
  check(u.email, u.ok, u.ok ? "email confirmado" : "SIN CONFIRMAR ⚠");
}

// 7. Frontend: sin secretos
console.log("\n── FRONTEND (dist) ──");
const fs = await import("node:fs");
let secretFound = false;
const scan = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + "/" + f.name;
    if (f.isDirectory()) { scan(full); continue; }
    if (!f.name.match(/\.(js|html)$/)) continue;
    const content = fs.readFileSync(full, "utf8");
    for (const pat of ["SUPABASE_SERVICE_ROLE_KEY"]) {
      if (content.includes(pat)) {
        console.log(`  ⚠⚠⚠ "${pat}" en ${f.name}`);
        secretFound = true;
      }
    }
  }
};
try { scan("./dist"); } catch {}
check("secretos en bundle", !secretFound, secretFound ? "⚠⚠⚠ SECRETO ENCONTRADO" : "0 secretos ✓");

// 8. Supabase client usa publishable key
console.log("\n── CONFIG.JS ──");
const cfg = fs.readFileSync("src/config.js", "utf8");
const isPublishable = cfg.includes("sb_publishable_") || cfg.includes("eyJ");
check("publishable key", isPublishable, isPublishable ? "Solo publishable key ✓" : "⚠ verificar formato");

// 9. owner_id en todas las políticas
console.log("\n── OWNER_ID CHECK ──");
const ownerPol = await client.query(`
  select tablename from pg_policies
   where schemaname='public'
     and roles::text like '%authenticated%'
     and qual like '%auth.uid()%'
   order by tablename
`);
check("owner_id policies", ownerPol.rows.length >= 9, `${ownerPol.rows.length} políticas con auth.uid() ✓`);

await client.end();
console.log(`\n=== RESULTADO: ${issues === 0 ? "✅ TODO SEGURO" : "⚠⚠⚠ " + issues + " PROBLEMAS DETECTADOS"} ===`);




