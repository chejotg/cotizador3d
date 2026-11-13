# Quickstart & Validación — Cotizador Web

Feature: 001-cotizador-web · Última actualización: 2026-11-08

## Prerequisitos

- Node 24 (para tests) y/o navegador moderno.
- Proyecto Supabase creado (plan gratuito); URL + anon key en `web/js/config.js`.
- `contracts/db-schema.sql` ejecutado en el SQL Editor de Supabase.
- `tools/seed.sql` ejecutado (tarifas + semillas: materiales, productos, COT-001..018 con snapshots).
- Usuario propietario creado en Supabase Auth (el email del negocio).

## Correr los tests del modelo de cobro

```powershell
cd web
npm install
npm run test        # vitest sobre src/pricing.js
```

✅ Esperado: todos los casos de ui-contract.md en verde (Q314.27, Q776.96, Q75.46, Q72.45...).

## Correr la web

```powershell
cd web
npm run dev         # http://localhost:5173 (HMR) — requiere Supabase URL/anon key en src/config.js
npm run build       # → dist/ estáticos para Netlify/GitHub Pages
npm run preview     # sirve dist/ para validación de deploy
```

✅ Esperado: pantalla de login → entrar con el email del propietario.

## Escenarios de validación (US por spec)

### US1 — Cotizar (caras de oro del negocio)

1. Pestaña **Cotizador**: llenar `Espada Maestra` · Tipo PLA · Creator 5 · 6 camas · 20 h · 583 g · MO 1.25 · Factura Sí.
   → El panel verde muestra: Filamento Q115.43 · Máquina Q50.00 · MO Q35.00 · Subtotal Q200.43 · Margen Q80.17 · TOTAL sin IVA Q280.60 · **Con factura Q314.27** (±Q0.01).
2. Guardar → toast con `COT-019` (número siguiente a la semilla) y fila nueva en Historial con snapshot igual al preview.
3. Editarla (subir gramos a 600) → total recalcula; aparece "Historial: cotizó Q314.27".

### US2 — Historial

1. Buscar `COT-015` → 1 resultado. Buscar `espada` (minúsculas) → 1 resultado.
2. Cambiar estado de `COT-019` a `Confirmada` → badge verde; refrescar la página → persiste (RLS OK).

### US3 — Inventario

1. Materiales: definir **Stock inicial** de PLA = 4000 g y Mínimo = 500 g → Saldo = 4000 − (600 de la edición de US1) = 3400 g.
2. Nueva cotización 200 g PLA → saldo de PLA baja automáticamente a 3200 g.
3. Piezas: producto `Espada Maestra` stock inicial 2 · registrar venta de 1 (US4) → saldo 1 · si VENDIERA 3 → saldo −1 y fila en rojo.

### US4 — Punto de venta

1. Registrar: HOY · Espada Maestra · cantidad 1 · factura Sí → toast `VT-001`, total Q314.27 (precio del catálogo 280.60 × 1.12 IVA).
2. Registrar otra venta sin factura de `Lote 12 Santas` (Q172.23) → `VT-002`, total Q172.23.
3. Resumen: fila de HOY muestra # ventas = 2, Total con factura = Q314.27, Total sin factura = Q172.23, TOTAL = Q486.50.
4. Anular `VT-002` → desaparece del resumen y las piezas vuelven al saldo del producto.

### US5 — Tarifas

1. Cambiar `margen` de 0.40 → 0.45 (amarillo).
2. Nueva cotización 100 g PLA 2 h MO 0.25 → el margen de la vista previa usa 45%.
3. Verificar que el histórico `COT-015` SIGUE mostrando Q314.27 (snapshot inmutable).
4. Restaurar 0.40.

### Edge cases

- Entrar sin login → no hay datos (RLS deny) y formulario bloqueado de guardar.
- Tipo PLA + Saturn 4 → rechazo `VALIDATION_ERROR` visible en toast (nunca estado intermedio).
- Cobro mínimo: cotizar 5 g PLA · 0.5 h impresión · MO 0 → el total sin IVA no debe caer por debajo de material + Q28 (piso de la regla 10); el desglose sigue visible.
- Desconectar internet → banner de conexión; el formulario conserva los valores; reconectar → Guardar funciona.
- Venta de producto inexistente → imposible (desplegable); forzar por consola → `NOT_FOUND`.

### US6 — Bandejas y combos (agregada 2026-11-08)

1. Cotizador: activa "Es una bandeja de impresión con múltiples piezas", agrega 4 piezas (2+1+1+1 con nombres) y elige "Se vende POR UNIDAD" → Guardar → el aviso muestra el precio por unidad (total ÷ 5) y en Historial aparece el badge BANDEJA · UNIDAD. Puedes escribir tu propio precio por unidad (si lo dejas vacío usa el sugerido).
2. En Historial cambia la bandeja a **Confirmada** (regla del POS: solo las Confirmadas se venden; Emitidas y Canceladas no aparecen).
3. POS → PIEZAS DE BANDEJAS: vende 2 unidades de una pieza → disponibles bajan y aparece VT-NNN en el resumen del día.
4. POS → ARMAR COMBO: toca 2 piezas distintas (1+1), nombre "Pack Prueba", precio default = suma → Guardar → VT-NNN; las unidades de ambas bandejas bajan.
5. Anular la venta del combo en el resumen → las unidades vuelven (disponibles suben).
6. Historial → 🗑 elimina una cotización sin ventas (pide confirmación); si intenta eliminar una con unidades vendidas, el rechazo explica anular esas ventas primero.

## Deuda conocida post-validación

- Importar/editar ml de resina (convertir con densidad 1.1) — v2.
- Reportes mensuales/exportar CSV — v2.

