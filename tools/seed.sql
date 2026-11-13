-- tools/seed.sql — Datos semilla del negocio (fuente: datos/negocio.md + datos/cotizaciones.md,
-- oct 2026). Ejecutar DESPUÉS de contracts/db-schema.sql. Requiere estar autenticado en Supabase
-- para cotizaciones: ver nota OWNER abajo.

-- ============ 1. TARIFAS (global, sin owner) ============
insert into tarifa (clave, valor, unidad, nota) values
  ('resina_qg',       0.27, 'Q/g', 'Sunlu transparente Q270/kg (dueño, oct 2026)'),
  ('pla_qg',          0.18, 'Q/g', 'Sunlu/genérico Q180/kg (dueño, actualizado oct 2026)'),
  ('desperdicio',     1.10, 'factor', '10% por fallos y soportes'),
  ('mo_qh',          28.00, 'Q/h', 'Única tarifa de mano de obra (dueño, oct 2026)'),
  ('margen',          0.40, '%', '40% sobre subtotal (dueño, oct 2026)'),
  ('iva',             0.12, '%', 'Solo si el cliente pide factura'),
  ('cons_bandeja',    5.10, 'Q/bandeja', 'IPA 2.50 + FEP 1.90 + guantes 0.70 (solo resina)'),
  ('cons_trabajo',    0.70, 'Q/trabajo', '1 par guantes postproceso (solo MSLA)'),
  ('primer_qfig',    23.63, 'Q/fig', 'Primer Vallejo 400ml ÷ 8 figuras grandes'),
  ('barniz_qfig',    15.75, 'Q/fig', 'Barniz Vallejo 400ml ÷ 12 figuras grandes'),
  ('pinturas_qfig',  13.00, 'Q/fig', 'Prorrateo conservador del stock Q1,300'),
  ('tarifa_saturn4',  1.75, 'Q/h', 'Luz 0.22 + deprec 1.00 + repuestos 0.10'),
  ('tarifa_saturn3',  1.50, 'Q/h', 'Luz 0.15 + deprec 0.92 + repuestos 0.10'),
  ('tarifa_creator5', 2.50, 'Q/h', 'Luz 1.06 + deprec 0.81 + repuestos 0.10'),
  ('embalaje_pequeña', 6.61, 'Q/emb', '≤5 cm — solo con envío o protección pedida'),
  ('embalaje_mediana', 23.93, 'Q/emb', '5–15 cm'),
  ('embalaje_grande',  47.03, 'Q/emb', '>15 cm o multi-part frágil')
on conflict (clave) do update set valor = excluded.valor, nota = excluded.nota;

-- ============ 2. MATERIALES ============
-- OWNER: reemplaza (select id from auth.users order by created_at limit 1) POR el uuid del usuario propietario antes de ejecutar
-- (Supabase Auth → Users). Ver abajo la línea DO $$ ... $$ que puede hacerlo automático.
insert into material (owner_id, nombre, unidad, descontable_por, stock_inicial, minimo) values
  ((select id from auth.users order by created_at limit 1), 'Resina Sunlu',        'g',      'resina', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'PLA',                 'g',      'pla',    0, 0),
  ((select id from auth.users order by created_at limit 1), 'IPA',                 'L',      null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'FEP/PFA láminas',     'u',      null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Guantes nitrilo',     'pares',  null,     0, 20),
  ((select id from auth.users order by created_at limit 1), 'Primer Vallejo',      'latas',  null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Barniz Vallejo',      'latas',  null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Pinturas acrílicas',  'figuras eq.', null, 0, 10),
  ((select id from auth.users order by created_at limit 1), 'Espuma SafeFoam',     'rollos', null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Papel burbuja',       'rollos', null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Stretch film',        'rollos', null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Cinta (tape)',        'rollos', null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Papel kraft',         'rollos', null,     0, 1),
  ((select id from auth.users order by created_at limit 1), 'Stickers',            'u',      null,     0, 50)
on conflict (owner_id, nombre) do update set unidad = excluded.unidad,
  descontable_por = excluded.descontable_por, minimo = excluded.minimo;

-- ============ 3. PRODUCTOS (catálogo del POS / piezas) ============
insert into producto (owner_id, nombre, precio_sin_iva, nota, stock_inicial, minimo) values
  ((select id from auth.users order by created_at limit 1), 'Espada Maestra',                 280.60, 'COT-015', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Nacimiento 12 cm',                72.45, 'COT-016', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Nacimiento minimalista 10 cm',    31.81, 'COT-017', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Fantasma sacando el dedo',        40.43, 'COT-018', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 Santas',                 172.23, 'COT-006', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 osos polares',           118.64, 'COT-008', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 renos navideños',        123.31, 'COT-009', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 galletas de jengibre',   125.40, 'COT-010', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 muñecos de nieve',       106.50, 'COT-011', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 12 árboles navideños',      145.56, 'COT-012', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Bandeja japandi',                 35.42, 'COT-007', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Bowl del Grinch',                 72.38, 'COT-014', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Santa (pequeña)',                 31.53, 'COT-005', 0, 0),
  ((select id from auth.users order by created_at limit 1), 'Lote 10 piezas PLA',              67.56, 'COT-004', 0, 0)
on conflict (owner_id, nombre) do update set precio_sin_iva = excluded.precio_sin_iva,
  nota = excluded.nota;

-- ============ 4. COTIZACIONES HISTÓRICAS con snapshot exacto de datos/cotizaciones.md ============
-- Los totales provienen del Excel (fuente de verdad histórica); NOTA: en COT-008/009/011
-- el Excel tenía redondeos a mano levemente distintos a la fórmula — se preservan tal cual
-- (Constitución V: paridad); las nuevas cotizaciones se calculan con la fórmula exacta.
insert into cotizacion (owner_id, folio, fecha, cliente, producto, tipo, impresora,
  bandejas, gramos, horas_impresion, horas_mo, horas_pintura, pintado, embalaje,
  factura, envio_q, estado, hist_total_previo,
  material_q, maquina_q, mano_obra_q, consumibles_q, acabado_q, embalaje_q,
  subtotal_q, margen_q, total_sin_iva_q, con_factura_q, total_a_cobrar_q) values
((select id from auth.users order by created_at limit 1), 'COT-001', '2026-10-24', '(por definir)', 'Figura He-Man 25 cm', 'Resina', 'Saturn 4',
  4, 720, 28, 8, 0, false, 'Grande', false, 0, 'Emitida', null,
  213.84, 49.00, 224.00, 21.10, 0, 47.03, 554.97, 221.99, 776.96, 870.19, 776.96),
((select id from auth.users order by created_at limit 1), 'COT-002', '2026-10-24', '(por definir)', 'Figura Bowsette 25 cm', 'Resina', 'Saturn 4',
  2, 300, 11, 10, 0, false, 'Grande', false, 0, 'Emitida', null,
  89.10, 19.25, 280.00, 10.90, 0, 47.03, 446.28, 178.51, 624.79, 699.77, 624.79),
((select id from auth.users order by created_at limit 1), 'COT-003', '2026-10-24', '(por definir)', 'Batman Shogun 17 cm (pintada)', 'Resina', 'Saturn 4',
  2, 260, 17, 8, 0, true, 'Ninguno', false, 0, 'Emitida', null,
  77.10, 29.75, 224.00, 10.90, 52.38, 0, 394.13, 157.65, 551.78, 617.99, 551.78),
((select id from auth.users order by created_at limit 1), 'COT-004', '2026-10-24', '(por definir)', 'Lote 10 piezas PLA', 'PLA', 'Creator 5',
  1, 72, 8, 0.5, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  14.26, 20.00, 14.00, 0, 0, 0, 48.26, 19.30, 67.56, 75.67, 67.56),
((select id from auth.users order by created_at limit 1), 'COT-005', '2026-10-24', '(por definir)', 'Santa (pequeña)', 'PLA', 'Creator 5',
  1, 20.92, 1.75, 0.5, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  4.14, 4.38, 14.00, 0, 0, 0, 22.52, 9.01, 31.53, 35.31, 31.53),
((select id from auth.users order by created_at limit 1), 'COT-006', '2026-10-24', '(por definir)', 'Lote 12 Santas', 'PLA', 'Creator 5',
  1, 240, 19, 1.0, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  47.52, 47.50, 28.00, 0, 0, 0, 123.02, 49.21, 172.23, 192.90, 172.23),
((select id from auth.users order by created_at limit 1), 'COT-007', '2026-10-24', '(por definir)', 'Bandeja japandi', 'PLA', 'Creator 5',
  1, 64, 2.25, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  12.67, 5.63, 7.00, 0, 0, 0, 25.30, 10.12, 35.42, 39.67, 35.42),
((select id from auth.users order by created_at limit 1), 'COT-008', '2026-10-24', '(por definir)', 'Lote 12 osos polares', 'PLA', 'Creator 5',
  1, 196, 15.55, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  38.88, 38.86, 7.00, 0, 0, 0, 84.74, 33.90, 118.64, 132.88, 118.64),
((select id from auth.users order by created_at limit 1), 'COT-009', '2026-10-24', '(por definir)', 'Lote 12 renos navideños', 'PLA', 'Creator 5',
  1, 198, 16.73, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  39.26, 41.82, 7.00, 0, 0, 0, 88.08, 35.23, 123.31, 138.11, 123.31),
((select id from auth.users order by created_at limit 1), 'COT-010', '2026-10-24', '(por definir)', 'Lote 12 galletas de jengibre', 'PLA', 'Creator 5',
  1, 213, 16.18, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  42.12, 40.45, 7.00, 0, 0, 0, 89.57, 35.83, 125.40, 140.45, 125.40),
((select id from auth.users order by created_at limit 1), 'COT-011', '2026-10-24', '(por definir)', 'Lote 12 muñecos de nieve', 'PLA', 'Creator 5',
  1, 183, 13.15, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  36.19, 32.88, 7.00, 0, 0, 0, 76.07, 30.43, 106.50, 119.28, 106.50),
((select id from auth.users order by created_at limit 1), 'COT-012', '2026-10-24', '(por definir)', 'Lote 12 árboles navideños', 'PLA', 'Creator 5',
  1, 277, 16.85, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  54.85, 42.12, 7.00, 0, 0, 0, 103.97, 41.59, 145.56, 163.03, 145.56),
((select id from auth.users order by created_at limit 1), 'COT-013', '2026-10-24', '(por definir)', 'Lote 4 esferas de nieve', 'PLA', 'Creator 5',
  1, 68, 2, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  13.46, 5.00, 7.00, 0, 0, 0, 25.46, 10.19, 35.65, 39.93, 35.65),
((select id from auth.users order by created_at limit 1), 'COT-014', '2026-10-24', '(por definir)', 'Bowl del Grinch', 'PLA', 'Creator 5',
  1, 150, 6, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  29.70, 15.00, 7.00, 0, 0, 0, 51.70, 20.68, 72.38, 81.07, 72.38),
((select id from auth.users order by created_at limit 1), 'COT-015', '2026-10-31', '(por definir)', 'Espada Maestra', 'PLA', 'Creator 5',
  6, 583, 20, 1.25, 0, false, 'Ninguno', true, 0, 'Emitida', 270.37,
  115.43, 50.00, 35.00, 0, 0, 0, 200.43, 80.17, 280.60, 314.27, 314.27),
((select id from auth.users order by created_at limit 1), 'COT-016', '2026-10-31', '(por definir)', 'Nacimiento 12 cm', 'PLA', 'Creator 5',
  1, 125, 8, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', 128.24,
  24.75, 20.00, 7.00, 0, 0, 0, 51.75, 20.70, 72.45, 81.14, 72.45),
((select id from auth.users order by created_at limit 1), 'COT-017', '2026-10-31', '(por definir)', 'Nacimiento minimalista 10 cm', 'PLA', 'Creator 5',
  1, 52, 2.1667, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  10.30, 5.42, 7.00, 0, 0, 0, 22.72, 9.09, 31.81, 35.63, 31.81),
((select id from auth.users order by created_at limit 1), 'COT-018', '2026-10-31', '(por definir)', 'Fantasma sacando el dedo', 'PLA', 'Creator 5',
  1, 60, 4, 0.25, 0, false, 'Ninguno', false, 0, 'Emitida', null,
  11.88, 10.00, 7.00, 0, 0, 0, 28.88, 11.55, 40.43, 45.28, 40.43)
on conflict (folio) do nothing;

-- Nota snapshots COT-016/015: hist_total_previo conserva el total anterior del md
-- (128.24 correspondía a la versión 15 cm) y 270.37 a la versión sin ensamblaje.

-- ============ 5. AJUSTAR SECUENCIAS tras la carga ============
select setval('folio_cotizacion_seq', (select max(substring(folio from 5)::int) from cotizacion));
select setval('folio_venta_seq', 1);

