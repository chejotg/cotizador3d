// Auditoría de seguridad completa
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log("=== AUDITORÍA DE SEGURIDAD ===\n");

// 1. RLS en todas las tablas
console.log("── 1. ROW LEVEL SECURITY (tablas) ──");
const rls = await client.query(`
  select tablename, rowsecurity
    from pg_tables where schemaname = 'public'
   order by tablename
`);
for (const t of rls.rows) {
  console.log(`  ${t.tablename.padEnd(28)} ${t.rowsecurity ? "✓ RLS ON" : "⚠ RLS OFF ⚠⚠⚠"}`);
}

// 2. Políticas RLS
console.log("\n── 2. POLÍTICAS RLS ──");
const pol = await client.query(`
  select tablename, policyname, cmd, roles, qual
    from pg_policies
   where schemaname = 'public'
   order by tablename, policyname
`);
for (const p of pol.rows) {
  const roles = typeof p.roles === "string" ? p.roles : Array.isArray(p.roles) ? p.roles.join(",") : String(p.roles || "?");
  const hasAnon = roles.includes("anon");
  const hasAuth = roles.includes("authenticated");
  console.log(`  ${p.tablename.padEnd(22)} ${p.policyname.padEnd(22)} ${p.cmd.padEnd(10)} roles=${roles} ${hasAnon ? "⚠ ANON!" : "✓"} ${hasAuth ? "auth✓" : "⚠ sin auth"}`);
}

// 3. Grants del rol anon
console.log("\n── 3. GRANTS ANON (deben ser 0 o mínimos) ──");
const grants = await client.query(`
  select table_name, privilege_type
    from information_schema.table_privileges
   where table_schema = 'public'
     and grantee = 'anon'
   order by table_name
`);
if (grants.rows.length === 0) {
  console.log("  ✓ anon no tiene grants — DENY BY DEFAULT");
} else {
  for (const g of grants.rows) {
    console.log(`  ⚠ anon tiene ${g.privilege_type} en ${g.table_name}`);
  }
}

// 4. Grants del rol authenticated
console.log("\n── 4. GRANTS AUTHENTICATED ──");
const grantsA = await client.query(`
  select table_name, privilege_type
    from information_schema.table_privileges
   where table_schema = 'public'
     and grantee = 'authenticated'
   order by table_name, privilege_type
`);
for (const g of grantsA.rows) {
  console.log(`  ${g.table_name.padEnd(25)} ${g.privilege_type}`);
}

// 5. Funciones RPC: grant a public o anon?
console.log("\n── 5. FUNCIONES RPC (grants) ──");
const rpcs = await client.query(`
  select p.proname, p.prosrc like '%security definer%' as is_definer,
         has_function_privilege('anon', p.oid, 'execute') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
   order by p.proname
`);
for (const f of rpcs.rows) {
  console.log(`  ${f.proname.padEnd(30)} definer=${f.is_definer ? "SÍ" : "no"}  anon_exec=${f.anon_exec ? "⚠ SÍ" : "✓ no"}  auth_exec=${f.auth_exec ? "✓" : "⚠ no"}`);
}

// 6. Views con security invoker?
console.log("\n── 6. VISTAS ──");
const views = await client.query(`
  select viewname,
         coalesce((select option_value from pg_options_to_table(pg_class.reloptions) where option_name = 'security_invoker'), 'false') as sec_inv
    from pg_views where schemaname = 'public'
   order by viewname
`);
for (const v of views.rows) {
  console.log(`  ${v.viewname.padEnd(25)} security_invoker=${v.sec_inv === "true" ? "✓" : "⚠ no"}`);
}

// 7. Usuarios activos
console.log("\n── 7. USUARIOS DE AUTENTICACIÓN ──");
const users = await client.query(`
  select email, email_confirmed_at is not null as confirmado
    from auth.users
   order by created_at
`);
for (const u of users.rows) {
  console.log(`  ${u.email.padEnd(35)} ${u.confirmado ? "✓ confirmado" : "⚠ SIN CONFIRMAR"}`);
}

// 8. Datos sensibles en el código (frontend)
console.log("\n── 8. SECRETOS EN EL FRONTEND (dist/) ──");
const fs = await import("node:fs");
const distFiles = [];
const scanDir = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir + "/" + f.name;
    if (f.isDirectory()) scanDir(full);
    else if (f.name.endsWith(".js") || f.name.endsWith(".html")) distFiles.push(full);
  }
};
try {
  scanDir("../dist");
} catch {}
let secretos = 0;
for (const f of distFiles) {
  const content = fs.readFileSync(f, "utf8");
  // buscar service_role o sb_secret
  if (content.includes("service_role") || content.includes("sb_secret_") || content.includes("SUPABASE_SERVICE_ROLE")) {
    console.log(`  ⚠⚠⚠ SECRETO ENCONTRADO EN: ${f}`);
    secretos++;
  }
}
if (secretos === 0) console.log("  ✓ No se encontraron secretos en el bundle");

// 9. Config: solo anon key?
console.log("\n── 9. CONFIG.JS (solo publishable key) ──");
const config = fs.readFileSync("../src/config.js", "utf8");
if (config.includes("sb_secret") || config.includes("service_role")) {
  console.log("  ⚠⚠⚠ SECRETO EN CONFIG.JS");
} else if (config.includes("sb_publishable") || config.includes("eyJ")) {
  console.log("  ✓ Solo publishable/anon key (pública)");
} else {
  console.log("  ⚠ No se pudo verificar el formato de key");
}

// 10. RLS policies: verificar owner_id
console.log("\n── 10. OWNER_ID EN POLÍTICAS ──");
const ownerPols = await client.query(`
  select tablename, policyname, qual
    from pg_policies
   where schemaname = 'public'
     and roles::text like '%authenticated%'
     and (qual like '%auth.uid()%')
   order by tablename
`);
console.log(`  ${ownerPols.rows.length} políticas con auth.uid() = owner check`);
for (const p of ownerPols.rows) {
  console.log(`  ${p.tablename.padEnd(25)} ✓ owner check`);
}

await client.end();
console.log("\n=== FIN AUDITORÍA ===");
