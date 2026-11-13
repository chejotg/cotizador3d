# AGENTS.md — COTIZADOR 3D

Proyecto nuevo (repo vacío al momento de escribir esto): agente para gestionar un negocio de impresión 3D (resina o filamento). No hay manifiestos, ni comandos de build/test/lint todavía — no los inventes; actualiza esta sección cuando existan.

## Objetivo del proyecto (definido por el usuario)

- Gestionar el negocio: cotizar trabajos de impresión 3D en resina o filamento.
- Mantener archivos de memoria del negocio con: productos, precios, impuestos y gastos del negocio.
- Llevar un registro de errores y mejoras para no repetir errores cometidos en sesiones anteriores.

## Convenciones obligatorias

- Los datos del negocio (productos, precios, impuestos, gastos) viven en archivos persistentes dentro del repo, no en la memoria de una sesión. Consultarlos antes de cotizar y actualizarlos cuando cambien.
- Cada vez que se comete un error o se identifica una mejora, registrarlo en el log de errores/mejoras (crear el archivo si no existe, p. ej. `MEJORAS.md`) con: qué pasó, por qué, y cómo evitarlo.
- Al cotizar, incluir siempre impuestos y gastos reales tomados de los archivos de memoria, no valores inventados.

## Estado

- Herramientas en Node.js (Node 24, `package.json`, dependencia `exceljs`): generación de Excel.
- `datos/cotizador.xlsx` — herramienta operativa del negocio (cotizador, historial, stock, tarifas). Regenerar con: `node tools/gen-cotizador-xlsx.js` (ojo: sobrescribe el archivo; exportar datos primero si se edita a mano). Después correr `tools/instalar-botones.ps1` para generar `datos/cotizador.xlsm` con los botones de guardar/búsqueda y las macros (usa el ajuste AccessVBOM temporalmente y lo restaura al terminar). El archivo operativo del día a día es el `.xlsm`. **IMPORTANTE: el instalador又会 migrá automáticamente los datos del xlsm previo al nuevo antes de reemplazarlo; si cambia el layout de hojas, actualizar el mapa de migración (`$map`) en `tools/instalar-botones.ps1` antes de regenerar.**
- `datos/catalogo.xlsx` — catálogo para clientes; regenerar con: `node tools/gen-catalogo-xlsx.js`.
- Los archivos `.md` en `datos/` siguen siendo la fuente de memoria; el Excel es la herramienta de cálculo diario. Si una cotización se ajusta en el Excel, actualizar también el `.md`.
- App web en desarrollo (Spec Kit feature 001-cotizador-web): `web/` (Vite + React + Supabase, `npm run dev`/`test`/`build`/`lint` desde `web/`; tests del modelo de cobro en `web/tests/pricing.test.js` con los casos oro del negocio). SQL de la DB: `specs/001-cotizador-web/contracts/db-schema.sql` y seed en `tools/seed.sql`. **DB ya ejecutada en el project Supabase del propietario (2026-11-08): schema + seed aplicados vía `web/run-sql.mjs` con DATABASE_URL del entorno (nunca guardar la contraseña de BD en archivos); credenciales públicas (URL + publishable key) en `web/src/config.js`. Design docs en `specs/001-cotizador-web/`. Tareas restantes: US4 POS, US2 historial, US3 inventario, US5 tarifas ya tienen views esbozadas en `web/src/views/`; validar en `specs/001-cotizador-web/quickstart.md`.**
- Rediseño de UI aplicado (2026-11-08): paleta propia sin Tailwind en `web/src/styles.css` (nav inferior móvil, accordiones, cards, panel de cálculo sticky, venta rápida en POS); **layout y carpetas de vistas/estilos DOMINAR la convención**: cada pantalla una view en `web/src/views/`, servicios por dominio en `web/src/services/`, nada de lógica de negocio en JSX (toda cuenta pasa por `web/src/pricing.js`).
