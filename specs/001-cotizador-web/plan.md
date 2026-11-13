# Implementation Plan: Cotizador Web (web estática + Supabase)

**Branch**: `001-cotizador-web` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cotizador-web/spec.md`

## Summary

Web estática (SPA vanilla JS sin build) que conecta a Supabase (Postgres + Auth + RLS) para: cotizar trabajos del negocio con el modelo de cobro exacto (material×factor, tarifa/h de máquina, Q28/h MO, consumibles, acabado, embalaje, margen 40%, IVA 12%), guardar con folios correlativos COT-NNN e historial editable/buscado, controlar inventario dual (materiales con consumo por cotización y piezas con descuento por venta), punto de venta con catálogo y resumen diario/mensual de ventas, y administración de tarifas central. Los totales se calculan en la base vía RPC transaccionales (fuente única de verdad) y se persisten como snapshot.

## Technical Context

**Language/Version**: React 18+ con Vite (build `vite build` → estáticos puros; JS ES2022 + JSX)

**Primary Dependencies**: `react`, `react-dom`, `@supabase/supabase-js` v2, `react-hook-form` (formularios), Vite (dev/build). Sin framework de CSS (hoja propia; Tailwind opcional en la fase de tareas — decisión mínima por defecto).

**Storage**: Supabase Postgres (tablas + vistas + funciones RPC `SECURITY DEFINER`), Auth email single-user

**Testing**: `vitest` para el módulo de precios (`pricing.js`, función pura); validación E2E vía `quickstart.md` (escenarios con cifras reales del negocio)

**Target Platform**: browser moderno (Chrome/Edge/Firefox/Safari), desktop + móvil responsive; hosting estático gratuito (Netlify o GitHub Pages) sirviendo `web/dist/`

**Project Type**: web estática (SPA React + BaaS; sin backend propio)

**Performance Goals**: carga < 3 s en 4G (bundle inicial < 200 KB gzipped); cálculo de cotización re-render < 16 ms (state-local) y 1 llamada RPC al guardar

**Constraints**: 100% plan gratuito (Supabase free tier ~500 MB DB, host estático gratis); anon key pública + RLS deny-by-default; service key NUNCA en el cliente; mono-usuario

**Scale/Scope**: 1 usuario, ~5 pantallas (Cotizador, Historial, Inventario, Punto de venta, Tarifas), ~18 cotizaciones históricas semilla, crecimiento proyectado ≈ 20 cotizaciones + 60 ventas/mes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Evidencia |
|---|---|---|
| I. Tarifas como única fuente de verdad | ✅ Pasa | Tabla `tarifa` en DB; RPC `guardar_cotizacion` calcula totales leyendo tarifas de DB (no constantes en código) |
| II. Exactitud numérica verificable | ✅ Pasa | Contrato de cálculo con casos reales (Espada Q314.27) en contracts/ui-contract.md + quickstart |
| III. Web estática sin servidor propio | ✅ Pasa | SPA React via `vite build` → estáticos puros + Supabase BaaS; sin backend propio; deploy en Netlify/Pages |
| IV. Privacidad por defecto | ✅ Pasa | RLS deny-by-default, `owner_id` + `(select auth.uid()) = owner_id`, grants mínimo, `to authenticated` |
| V. Paridad con el Excel | ✅ Pasa | Folios/estados/categorías idénticos; semilla COT-001..018 con snapshots; fórmulas idénticas al .xlsm |
| VI. Simplicidad (YAGNI) | ✅ Pasa | Vite+React decidido con el propietario tras comparar vanilla/Next/Vue (research §1); sigue SPA estática sin backend, sin SSR ni toolchain extra |

No hay violaciones. Complexity Tracking: vacío (sin violaciones que justificar).

## Project Structure

### Documentation (this feature)

```text
specs/001-cotizador-web/
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas (Phase 0)
├── data-model.md        # Entidades y campos (Phase 1)
├── quickstart.md        # Escenarios de validación (Phase 1)
├── contracts/           # Phase 1
│   ├── db-schema.sql    # Tablas, RLS, RPCs (migración única v1)
│   ├── rpc-contract.md  # Firmas y comportamientos de las funciones
│   └── ui-contract.md   # Pantallas, rutas y contrato de cálculo
└── tasks.md             # Phase 2 (/speckit.tasks — NO se crea aquí)
```

### Source Code (repository root)

```text
web/                        # App Vite + React (deploy: contenido de dist/)
├── package.json            # deps react/react-dom/supabase-js/react-hook-form + vite/vitest
├── vite.config.js          # build estático (base configurable para GitHub Pages)
├── index.html              # Shell SPA
├── src/
│   ├── main.jsx            # Bootstrap: Supabase client + Auth gate + React root
│   ├── App.jsx             # Tabs/route (react-router o hash-lite — decidido en tasks)
│   ├── config.js           # Supabase URL + anon key (pública, no secreta)
│   ├── auth.jsx            # Contexto de sesión (login/logout del propietario)
│   ├── pricing.js          # Función PURA de cálculo (tarifas → componentes) — testeable sin DOM
│   ├── services/
│   │   ├── cotizaciones.js # fetch/rpc/editar — wrapper de supabase-js
│   │   ├── inventario.js   # saldos, movimientos, alertas
│   │   ├── ventas.js       # registrar/anular/resumen
│   │   └── tarifas.js      # CRUD de tarifas
│   ├── components/
│   │   ├── MoneyInput.jsx  # input GTQ Q#,##0.00
│   │   ├── Badge.jsx       # estados (Emitida/Confirmada/...)
│   │   └── CalcPanel.jsx   # panel verde del desglose (usado por Cotizador y POS)
│   ├── views/
│   │   ├── Cotizador.jsx   # US1: form + cálculo en vivo + guardar
│   │   ├── Historial.jsx   # US2: buscador/edición/estados
│   │   ├── Inventario.jsx  # US3: materiales + piezas + alertas
│   │   ├── POS.jsx         # US4: venta nueva + resumen por fecha
│   │   └── Tarifas.jsx     # US5: administración de tarifas
│   └── styles.css          # Paleta del Excel (azul/verde/amarillo/rojo/morado)
└── tests/
    └── pricing.test.js     # vitest: casos oro (Q314.27, Q776.96, Q75.46, Q72.45)

tools/
└── seed.sql                # Tarifas reales + semillas (materiales, catálogo, COT-001..018)
```

**Structure Decision**: un solo entorno `web/` (frontend puro, sin backend directo) a nivel de repo raíz; `tools/seed.sql` para la migración semilla desde los datos del Excel. La raíz del repo sigue albergando los datos del negocio y el Excel operando en paralelo hasta validar la web.

## Complexity Tracking

> Sin violaciones de constitución que justificar — tabla intencionalmente vacía.
