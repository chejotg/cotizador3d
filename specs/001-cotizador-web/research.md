# Research — Cotizador Web

Fecha: 2026-11-08 · Feature: 001-cotizador-web

## 1. Framework de UI para la SPA

- **Decision**: **Vite + React 18/19** (JSX + ES modules). El build (`vite build`) produce archivos estáticos (HTML+JS+CSS con cache-busting) deployables en cualquier hosting libre. Supabase client singleton + React Hook Form para formularios, y componentización real de tablas (Inventario/Historial). El módulo de precios (`pricing.js`) se mantiene como función pura independiente de React para poder testearla con `node:test` (o vitest).
- **Rationale**: elegido con el propietario (después de evaluar vanilla/Next/Vue). Vite provee HMR y componentes sin perder la naturaleza 100% estática (Constitución III); React tiene el ecosistema más maduro para supabase-js (Supabase Auth helpers/hooks documentados) y maneja bien formularios con cálculo en vivo — el punto más repetitivo del negocio. Next.js fue descartado: su oferta de SSR/API/caching aporta poco en una app privada con Supabase, y su "static export" es solo una manera más pesada de lograr lo mismo que Vite.
- **Alternatives considered**: vanilla JS (cero build, pero duplicación de plumbing UI para 5 pantallas; descartado con el propietario), Next.js (overkill; ver conversación con el propietario), Vite+Vue (válido; ecosistema Supabase más pequeño y el propietario no expresó preferencia por Vue).

## 2. Acceso a datos — cliente y seguridad (RLS)

- **Decision**: `@supabase/supabase-js` v2 cargado por CDN ESM con **anon key pública** + RLS estricto. Auth con email fijo del propietario (password; magic link opcional). Todas las tablas con `owner_id uuid` y políticas:
  ```sql
  alter table cotizacion enable row level security;
  revoke all on cotizacion from anon;
  create policy "owner all" on cotizacion for all
    to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);
  ```
  Índice en `owner_id` de cada tabla con RLS. Nunca `service key` en el cliente (bypass RLS).
- **Rationale**: es el patrón recomendado por Supabase (docs "Securing your data" / RLS best practices): publishable/anon key es segura **solo** con RLS activo y grants mínimos; `to authenticated` evita que rolen políticas contra `anon`; `(select auth.uid())` en lugar de `auth.uid()` la evalúa una vez por statement (mejora exponencial de performance); `USING`+`WITH CHECK` juntos impiden reasignar `owner_id`.
- **Alternatives considered**: Edge Functions como proxy (capa extra sin beneficio para 1 usuario, rompe "web estática"); Supabase storage por buckets (no aplica).

## 3. Folios correlativos (COT-NNN / VT-NNN) y transaccionalidad

- **Decision**: generar folio y snapshot de totales dentro de funciones Postgres RPC (`SECURITY DEFINER`), llamadas por `supabase.rpc()`:
  - `guardar_cotizacion(...)`: secuencia `folio_cotizacion_seq` → `COT-``lpad```, calcula **todos** los componentes leyendo la tabla `tarifa` dentro de la misma transacción, hace `insert` con snapshot y descuenta material/gramos del inventario (por tipo), retorna la fila completa.
  - `registrar_venta(...)`: secuencia `folio_venta_seq` → `VT-``,lpad``, inserta venta con snapshot de subtotal/IVA/total y descuenta cantidad del producto (con chequeo de existencias: si saldo < cantidad el inventario queda negativo con marca; no hard-block según spec).
  - `anular_venta(p_folio)`: marca `anulada`, excluye en vistas/resúmenes y **devuelve** piezas al inventario.
- **Rationale**: PostgREST envuelve cada RPC en transacción → atomicidad garantizada (insert + descuento de stock, sin estados intermedios); las secuencias Postgres son concurrencia-safe (nunca folios duplicados; cumple FR-2); corrén como `security definer` para poder escribir sin grants amplios al rol `authenticated`, con `search_path` fijado y `revoke` al público.
- **Alternatives considered**: `max(n)+1` en el cliente (carrera/duplicados en guardado concurrente, por eso FR-2 exige transacción); lógica de cálculo en JS del navegador (haría tarifas duplicadas client/server; pierde una sola fuente de verdad — solo se usa como **preview**).

## 4. Moneda, redondeos y snapshots

- **Decision**: `numeric(12,2)` para dinero en Postgres; en JS números de punto flotante solo para preview con redondeo a 2 decimales para display. Snapshot de totales persistido (`numeric(12,2)`) en `cotizacion` y `venta`.
- **Rationale**: los totales históricos NO deben cambiar si cambia una tarifa (Constitución I: snapshot inmutable); Q decimal 2 exacto coincide con el Excel (formato Q#,##0.00).
- **Alternatives considered**: recomputar históricos al vuelo (reduca fidelidad histórica; rechazado).

## 5. Consumo de inventario

- **Decision**: para **materiales**, el consumo automático es derivado — sin tabla espejo: vista `consumo_material` = agregado de `cotizacion` (gramos por tipo de impresión); las ventas no consumen material (solo piezas). Alerta de stock = saldo de la vista vs `minimo`.
- **Piezas**: consumo por ventas derivado de `venta` (no anulada) agregada por producto; producción/entradas vía tabla `movimiento_producto`; salidas manuales vía `movimiento_material` / `movimiento_producto` con signo.
- **Rationale**: eliminar duplicidad (una sola fuente por dato → menos bugs de sincronización); las vistas se pueden probar con SQL.
- **Alternatives considered**: tabla de "consumo por cotización" espejo (el Excel lo usa por compatibilidad de layout; en web la vista da el mismo dato sin duplicación).

## 6. Despliegue

- **Decision**: Netlify (drag & drop o CLI) del folder `web/` + Supabase project free tier. Fallback: GitHub Pages.
- **Rationale**: hosting estático gratuito, HTTPS, cache; sin configuración de build (vanilla).
- **Alternatives considered**: Vercel (equivalente), hosting pago (rechazado: constraint gratuito).

## 7. Testing

- **Decision**: `node:test` (o vitest) sobre `pricing.js` con casos de la especificación (cifras reales: COT-015 = Q314.27 con factura, etc.). E2E manual por `quickstart.md` contra la instancia real de Supabase de prueba (escenarios US1..US5).
- **Rationale**: la parte más crítica y determinística del negocio es el modelo de cobro (Constitución II); el DOM/testing E2E automatizado excedería el alcance v1 para 1 usuario.
- **Alternatives considered**: Playwright E2E (deferred — se activará solo si la operación futura lo requiere).

## 8. Migración de datos del Excel

- **Decision**: `tools/seed.sql` con tarifas reales (oct 2026), materiales con stock = 0 inicial (el propietario definirá su stock real al primer uso), catálogo de productos (mismo que Inventario del Excel), y las 18 cotizaciones históricas con snapshots (folios COT-001..018 preservados con contador de secuencia ajustado a 18).
- **Rationale**: Paridad (Constitución V); el historial valorado debe coincidir exactamente con `datos/cotizaciones.md`.
- **Alternatives considered**: importador CSV dinámico (unnecessary para 18 filas).
