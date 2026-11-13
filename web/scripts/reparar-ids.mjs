// Repara combo_guardado con pieza_ids muertos (los re-asigna al id vigente de la misma bandeja
// cuando la bandeja tiene 1 sola pieza; si tiene varias, deja nota y no toca).
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: combos } = await client.query(
  `select id, nombre, lineas from combo_guardado`
);
for (const c of combos) {
  let cambio = false;
  const lineas = [];
  for (const l of c.lineas ?? []) {
    const pid = (l.pieza_id || "").replace(/["]/g, "");
    const { rows: existe } = await client.query(
      `select 1 from cotizacion_pieza where id = $1`, [pid]
    );
    if (existe.rowCount > 0) {
      lineas.push(l);
      continue;
    }
    const { rows: valida } = await client.query(
      `select pz.id, pz.nombre, pz.cantidad
         from cotizacion_pieza pz
        where pz.folio = $1`,
      [l.cot_folio || (l.pieza_id || "") && null].filter(Boolean)
    );
    // fallback: buscar por folio del propio combo si la bandeja tiene 1 pieza
    const { rows: unica } = await client.query(
      `select pz.id
         from cotizacion c
         join cotizacion_pieza pz on pz.folio = $1
        where c.folio = $1 and pz.owner_id = (select owner_id from combo_guardado where id = $2)
        group by pz.id, pz.folio
       having count(*) = 1`,
      [l.cot_folio, c.id]
    );
    if (unica.rowCount > 0) {
      lineas.push({ ...l, pieza_id: unica.rows[0].id });
      cambio = true;
      console.log(`✓ ${c.nombre}: pieza muerta → nueva pieza ${unica.rows[0].id}`);
    } else {
      lineas.push(l);
      console.log(`⚠ ${c.nombre}: no se pudo remapear (bandeja con varias piezas o inexistente)`);
    }
  }
  if (cambio) {
    await client.query(`update combo_guardado set lineas = $1 where id = $2`, [
      JSON.stringify(lineas),
      c.id,
    ]);
  }
}
await client.end();
console.log("fin reparación combo_guardado");
