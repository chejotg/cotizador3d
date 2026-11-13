// Ejecuta archivos .sql (multi-comando) contra una DB remota con pg (protocolo simple).
// Uso: node run-sql.mjs <archivo.sql> — lee DATABASE_URL del entorno (-env settea antes).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node run-sql.mjs <archivo.sql>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL en el entorno");
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  const res = await client.query(sql); // sin parámetros → protocolo simple → multi-statement OK
  // res es array si hubo múltiples statements con resultados
  if (Array.isArray(res)) {
    console.log(`OK: ${res.length} bloques ejecutados`);
  } else {
    console.log(`OK: 1 bloque (${res.command}, rowCount=${res.rowCount})`);
  }
} catch (e) {
  console.error("SQL ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
