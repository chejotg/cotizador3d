# Tasks: Cotizador Web (web estática Vite+React + Supabase)

**Input**: Design documents from `/specs/001-cotizador-web/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ (db-schema.sql, rpc-contract.md, ui-contract.md) ✅ · quickstart.md ✅ · constitution.md ✅

**Tests**: Incluidos según lo planificado (plan.md): vitest sobre `pricing.js` con los 4 casos oro. El resto de validación es E2E manual por quickstart.md.

**Organization**: Por historia de usuario, en orden de prioridad del spec (US1 P1, US4 P1, US2 P2, US3 P2, US5 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: correspondable en paralelo (archivos distintos, sin dependencias entre sí)
- **[Story]**: historia a la que pertenece (US1..US5)
- Todas las descripciones incluyen ruta exacta de archivo

## Path Conventions

- Frontend: `web/src/` · tests: `web/tests/` · SQL/migración: `contracts/db-schema.sql` + `tools/seed.sql` (layout del plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Proyecto inicializado y Supabase listo

- [x] T001 Scaffold de la app en `web/`: `npm create vite@latest . -- --template react`, agregar `react-hook-form`, `@supabase/supabase-js`, `vitest` (dev) al `web/package.json`; `vite.config.js` con `build.outDir: 'dist'` y `base` configurable
- [x] T002 Crear el proyecto Supabase y ejecutar `contracts/db-schema.sql` en el SQL Editor (tablas + RLS + vistas + RPCs; confirmar `to authenticated` en TODAS las políticas y grants denegados para `anon`) 
- [x] T003 Ejecutar ``tools/seed.sql`` (tarifas reales oct 2026, 14 materiales, catálogo de productos, COT-001..018 con snapshots, `folio_cotizacion_seq` starting 19) y verificar con el SQL Editor que `select folio, total_a_cobrar_q from cotizacion order by folio limit 1` → COT-001 
- [x] T004 [P] Configurar ESLint en `web/` (flat config del template react) y script `npm run lint`; no agregar prettier (v1, YAGNI)

**Checkpoint**: `npm run dev` sirve la shell; DB accesible con anon key.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cálculo, conexión y shell — bloquea TODAS las historias

**⚠ CRITICAL**: Ninguna historia arranca hasta completar aquí

- [x] T005 Implementar módulo puro de cálculo en `web/src/pricing.js` EXACTAMENTE con las fórmulas de `data-model.md` (material_q, maquina_q, mano_obra_q = (horas_mo+horas_pintura)×mo_qh, consumibles solo resina: bandejas×cons_bandeja+cons_trabajo, acabado solo pintado, embalaje por categoría con 0 en 'Ninguno', subtotal, margen, **total_sin_iva = max(suma+margen, cobro_minimo = material+1×mo_qh+consumibles — regla 10 negocio.md)**, con_factura, total_a_cobrar, precio venta final default, extra_ganado); redondeo half-up a 2 decimales POR componente antes de sumar
- [x] T006 [P] Escribir tests TDD primero (deben FALLAR sin T005, pasar después) en `web/tests/pricing.test.js` con los casos oro: COT-015 → Q314.27 con factura; COT-001 → Q776.96 sin IVA; 50 g/3 h/1 h MO/1 bandeja → Q75.46; COT-016 → Q72.45; COT-005 → Q31.53 (valida que el piso de cobro mínimo no altera órdenes chicas ya bien cotizadas)
- [x] T007 Crear `web/src/config.js` (SUPABASE_URL + anon key del proyecto, nunca secret key — constitución IV) y singleton `createClient` en `web/src/services/supabase.js` con `persistSession: true`
- [x] T008 Implementar `web/src/services/tarifas.js`: `fetchTarifas()` → objeto plana `{clave: valor}` desde la tabla `tarifa` (un solo select, cache en memoria de sesión)
- [x] T009 Implementar gate de Auth en `web/src/auth.jsx` (contexto de sesión con `onAuthStateChange`, pantalla de login email+password en `web/src/views/Login.jsx`; sin sesión → solo login visible; error message por síntoma)
- [x] T010 Shell SPA: `web/src/App.jsx` con navegación por tabs hash (`#/cotizador`, `#/historial`, `#/inventario`, `#/pos`, `#/tarifas`) y `web/src/styles.css` con la paleta del Excel (azul #2F4358, verde resultados, amarillo inputs, rojo alertas, morado folio)

**Checkpoint**: login funciona, tarifas cargan desde DB, `npm run test` en verde — las historias pueden empezar.

---

## Phase 3: User Story 1 — Cotizar un trabajo (P1) — MVP

**Goal**: Form del cotizador que calcula en vivo según tarifas de DB y guarda con folio COT-NNN + snapshot por RPC

**Independent Test**: llenar Espada Maestra (583 g · 20 h · 6 camas · MO 1.25 · factura Sí) → desglose en vivo Q314.27; Guardar → COT-019 persistida en historial

### Implementation for User Story 1

- [x] T011 [P] [US1] Componente `web/src/components/CalcPanel.jsx`: panel verde de desglose (Material/Máquina/MO/Consumibles/Acabado/Embalaje/Margen/Subtotal/TOTAL sin IVA/Con factura/TOTAL a cobrar) con formato `Q#,##0.00` y helper `web/src/format.js` (formatQd, redondeo half-up)
- [x] T012 [P] [US1] Componente `web/src/components/MoneyInput.jsx` (input numérico con paso 0.01, placeholders al estilo del Excel) + `web/src/components/StockPanel.jsx` (Stock resultante PLA/resina; rojo si la cotización excede el saldo — gramos vs vista `saldo_material`)
- [x] T013 [US1] Vista `web/src/views/Cotizador.jsx`: form (Fecha default hoy · Cliente · Producto · Tipo Resina/PLA · Impresora filtrada: PLA→Creator 5, Resina→Saturn 4/3 · Bandejas ≥1 · Horas impresión · Gramos ≥0 · Horas MO default 0.25 · Horas pintura · Pintado Sí/No · Embalaje Ninguno/Pequeña/Mediana/Grande · Factura Sí/No · Envío Q≥0) recalculando el CalcPanel en cada cambio con pricing.js + tarifas de DB
- [x] T014 [US1] `web/src/services/cotizaciones.js`: wrapper `guardarCotizacion(inputs)` → `supabase.rpc('guardar_cotizacion', {...})` con mapeo p_* exacto de `rpc-contract.md`; manejo errores AUTH_REQUIRED/VALIDATION_ERROR → toast en español
- [x] T015 [US1] Botón GUARDAR en `web/src/views/Cotizador.jsx`: llama T014, muestra folio asignado (`COT-0XX`) en banner verde-morado, limpia el form a defaults, y deja la fecha de hoy

**Checkpoint (MVP)**: US1 funcional y testeable con quickstart §US1 (cifras exactas).

---

## Phase 4: User Story 4 — Punto de venta y registro de ventas (P1)

**Goal**: Registrar ventas del catálogo con IVA conditional, folio VT-NNN y resumen por fecha

**Independent Test**: 2 ventas de&nbsp;hoy (Espada factura Sí → Q314.27 · Lote 12 Santas → Q172.23) → VT-001/VT-002 · resumen del día: #=2, con factura 314.27, sin 172.23, TOTAL 486.50

### Implementation for User Story 4

- [x] T016 [P] [US4] `web/src/services/ventas.js`: `registrarVenta()`, `anularVenta(folio)`, `resumenDia(fecha)` (COUNTIFS/SUMIFS equivalentes filtrando `anulada=false`, sin factura=factura false), `ventasDelDia(fecha)` SELECT ordenado por folio
- [x] T017 [US4] Vista `web/src/views/POS.jsx` — NUEVA VENTA: Fecha (hoy) · Cliente ('(mostrador)') · Producto (dropdown del catálogo `producto`) · Cantidad ≥1 · Precio unitario auto-desde catálogo editable · Factura Sí/No → Subtotal/IVA/TOTAL en vivo (pricing no; reglas de venta del data-model) con botón REGISTRAR VENTA → `registrarVenta()` → toast VT-0NN + limpiar
- [x] T018 [US4] Resumen por fecha en `POS.jsx`: fila HOY automática `{fecha: today}` + filas adicionales por fecha tipeada con # ventas, Total sin factura, Total con factura, TOTAL (`Q#,##0.00`); lista de ventas del día con botón anular (confirm() → `anularVenta`) y badge de anulada (gris, tachada)

**Checkpoint**: US1 + US4 funcionan; el inventario de piezas se descuenta solo (vista derivada).

---

## Phase 5: User Story 2 — Historial y administración de cotizaciones (P2)

**Goal**: Buscar, editar y administrar estados/precio venta final de las cotizaciones

**Independent Test**: buscar `COT-015` → 1 fila; cambiar estado a Confirmada → persiste tras refresco; fijar precio venta manual → Extra ganado recalcula (verde ≥0 / rojo <0); Editar → Cotizador precargado → cambiar gramos → historial "cotizó Q…previo"

### Implementation for User Story 2

- [x] T019 [P] [US2] Agregar a `web/src/services/cotizaciones.js`: `listarCotizaciones()` (SELECT ordenado folio DESC), `fijarPrecioVenta(folio, precio)` (UPDATE directo de.columna — RLS owner), `editarCotizacion(folio, inputs, estado)` → RPC `editar_cotizacion` con mapeo p_*
- [x] T020 [US2] Componente `web/src/components/Badge.jsx` (Emitida azul/Confirmada verde/Entregada cyan/Cancelada roja) y `web/src/components/EstadoSelect.jsx` (dropdown con transiciones válidas)
- [x] T021 [US2] Vista `web/src/views/Historial.jsx`: tabla (Folio · Fecha · Cliente · Producto · Tipo/Máquina · Gramos · Horas · Estado badge · TOTAL sin IVA · Con factura · Precio venta final inline-editable · Extra ganado coloreado · Acción Editar) + busca client-side (folio/producto/cliente, case-insensitive) + filtro por estado
- [x] T022 [US2] Flujo de edición: Historial Editar → precarga `Cotizador.jsx` con los datos + banner "editando COT-0XX"; Guardar llama `editarCotizacion` (no `guardar`); tras éxito el histórico muestra `hist_total_previo` ("Historial: cotizó Q…") en la fila, según `quickstart §US1.3`

**Checkpoint**: US1/US4/US2 integradas — ciclo completo de cotización.

---

## Phase 6: User Story 3 — Controlar inventario (P2)

**Goal**: Materiales y piezas con stock inicial editable, consumo automático derivado, alertas de reposición

**Independent Test**: definir stock inicial PLA 4000/mín 500 → saldo 3400 tras las cotizaciones de los checkpoints; REPOSICIÓN roja al caer al mínimo; producción +10 Espadas → saldo piezas sube; venta −1 → baja

### Implementation for User Story 3

- [x] T023 [P] [US3] `web/src/services/inventario.js`: `fetchMateriales()` (saldos via vista `saldo_material`), `fetchConsumoPorCotizacion()` (loop de cotizaciones para g resina/PLA + lavados IPA=bandejas + FEP=bandejas/40 + guantes=bandejas+1 — visual, no persistido), `fetchProductosSaldo()` (vista `saldo_producto`), `addMovimientoMaterial()`, `addProduccion()`, `updateStockInicial()`, `updateMinimo()`
- [x] T024 [US3] Vista `web/src/views/Inventario.jsx` — bloque MATERIALES: Ítem · Unidad · Stock inicial (amarillo editable) · Entradas · Consumido por cotizaciones (auto) · Salidas manuales · Saldo (verde; rojo si <0) · Mínimo (amarillo) · Alerta `REPOSICIÓN` roja si saldo ≤ mínimo; inline-edit de inicial/mínimo persistiendo al blur
- [x] T025 [US3] Vista bloque PIEZAS en `Inventario.jsx`: Producto · Producción · Vendidas (auto) · Salidas manuales · Stock inicial · Saldo · Mínimo · Alerta (misma regla); tablas PRODUCCIÓN (fecha, producto, piezas) y MOVIMIENTOS DE MATERIAL (fecha, ítem, entrada, salida, nota) con formularios en línea
- [x] T026 [US3] Bloque "Consumo por cotización" en `Inventario.jsx`: tabla creadas por COT con lo served por T023 (resina g · PLA g · IPA lavados · FEP láminas · guantes pares), cebra al estilo del Excel

**Checkpoint**: inventario dual completo; los descuentos automáticos funcionan sin escribir el inventario desde ninguna otra vista.

---

## Phase 7: User Story 5 — Administrar tarifas y catálogo (P3)

**Goal**: Única pantalla donde cambian las tarifas del negocio (tabla `tarifa`) y del catálogo de productos

**Independent Test**: margen 0.40→0.45 → preview de nueva cotización usa 45%; COT-015 histérica SIGUE Q314.27 (snapshot); restaurar 0.40

### Implementation for User Story 5

- [x] T027 [P] [US5] `web/src/services/tarifas.js`: agregar `updateTarifa(clave, valor)` (UPDATE directo; la policy actual "tarifa read" es select-only, agregar policy de update para authenticated en Supabase), y CRUD del catálogo `producto` en `web/src/services/inventario.js` (crear/editar precio/nota/mínimo/stock inicial)
- [x] T028 [US5] Vista `web/src/views/Tarifas.jsx`: tabla (clave · valor amarillo editable · unidad · nota solo lectura) con guardado al blur + banner "cambiar una tarifa afecta las próximas cotizaciones; los históricos mantienen su snapshot"; sección CATÁLOGO: productos con precio sin IVA editable y precio con IVA calculado en vivo (×1.12)

**Checkpoint**: US5 cierra el ciclo de administración; las 5 pantallas operativas.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting que toca varias US

- [x] T029 [P] Responsive completo en `web/src/styles.css` y vistas (los 5 tabs usable en celular; tablas con scroll horizontal si >576px? — métricas: SC-6)
- [x] T030 [P] Banner de estado de conexión (supabase realtime/health: simple `navigator.onLine` + error handler global) en `web/src/App.jsx`: "sin conexión: el formulario conserva sus datos"
- [x] T031 Seguridad: re-auditar `contracts/db-schema.sql` en Supabase (RLS on en todas, grants anon denegados, RPCs `revoke` public + `grant` authenticated, nunca secret key en bundle — grep en `web/dist/`)
- [ ] T032 [P] Cargar semillas de datos con snapshots EXACTOS de `datos/cotizaciones.md` (18 cotizaciones COT-001..018) — la parte de T003 que garantiza paridad; validar los folios y totales con una consulta en el SQL Editor
- [ ] T033 Ejecutar `quickstart.md` completo (US1..US5 + edge cases) contra la DB real y corregir desvíos
- [x] T034 Deploy en Netlify → **https://tangocash.netlify.app** — verificado con Playwright: login ✓, 15 cotizaciones visibles ✓, manifest.json ✓, service worker registrado ✓, nav móvil 7 tabs ✓, 0 page-errors. PWA instalable en Android (Chrome → Instalar aplicación)
- [ ] T035 Documentación: actualizar `AGENTS.md` (nueva app web, comandos npm, flujo de deploy), registro en `MEJORAS.md` si se cometió error operativo durante la implementación; marcar el feature como listo para migrar del Excel (plan paralelo 1 mes)

**Checkpoint**: feature web-ready; validada contra cifras del negocio.

---

## Phase 9: Expansión — bandejas multi-pieza, cobro por unidad y combos (US6)

- [x] T036 [US6] Migración 2 en `contracts/migracion-2-bandejas.sql` (columnas es_bandeja/metodo_cobro/precio_venta_unidad · tablas cotizacion_pieza y venta_combo_linea · vista piezas_bandeja · RPCs vender_unidad_bandeja y registrar_combo · anular v2 con devolución) — ejecutada en la DB (2026-11-08)
- [x] T037 [US6] Constrúyelo: `web/src/services/bandejas.js` (fetchPiezasDisponibles/porFolio, venderUnidadBandeja, registrarCombo)
- [x] T038 [US6] Cotizador con modo bandeja en `web/src/views/Cotizador.jsx`: toggle, editor de piezas, selector total/unidad, preview del precio por unidad, carga de piezas al editar; services `cotizaciones.js` con mapeo de paráextras (p_piezas jsonb)
- [x] T039 [US6] POS: en `POS.jsx`, sección PIEZAS DE BANDEJAS (venta por unidad con cantidad, factura de zona) y ARMAR COMBO (líneas con ±unidades, precio editable, registro atómico)
- [x] T040 [US6] Historial muestra badge BANDEJA · TOTAL / UNIDAD con precio por unidad en `Historial.jsx`

---

## Phase 10: Ajustes de flujo — eliminar, POS solo Confirmadas, precio por unidad manual

- [x] T041 Migración 3 en `contracts/migracion-3-ajustes.sql` (RPC `eliminar_cotizacion` con guard de unidades vendidas · vista `piezas_bandeja` v2 con estado · guardar/editar v3 con `p_precio_venta_unidad`) — ejecutada en la DB, 2026-11-08
- [x] T042 Historial: botón 🗑 eliminar con confirmación (tabla y tarjeta móvil) y service `eliminarCotizacion` en `web/src/services/cotizaciones.js`
- [x] T043 POS filtra piezas `.eq("estado","Confirmada")` en `web/src/services/bandejas.js` — Emitidas aún no se venden; Canceladas nunca se muestran
- [x] T044 Cotizador: input **"Precio por unidad"** (vacío = sugerido total÷Σ) en `web/src/views/Cotizador.jsx`; viaja como `p_precio_venta_unidad`; precarga el valor guardado al editar
- [x] T045 docs: `rpc-contract.md` (migración 3) y `quickstart.md` (US6 con flujo Confirmada/eliminar)

---

## Phase 11: Revisión visual con Playwright y arreglos de UI (post-rediseño)

- [x] T046 Playwright instalado (`npm i -D playwright`, chromium) + scripts en `web/scripts/` (check-ui.mjs capturas desktop/móvil por pestaña, debug-net.mjs, debug-dom.mjs, gen-hash.mjs) y capturas en `specs/001-cotizador-web/ui-review/`
- [x] T047 Login arreglado operativamente: email confirmado por SQL (auth.users) + hash bcrypt de la contraseña — verificado con la API de auth (200)
- [x] T048 Superposiciones eliminadas: headers de tabla ya no sticky con altura fija; piezas de bandeja con scroll propio; POS bandejas/combos full-width; forms colapsan en pantallas medianas; ARMAR COMBO abierto por defecto
- [x] T049 Vistas DB re-definidas: `saldo_material` y `saldo_producto` exponen `stock_inicial` + `alerta` (contracts/migracion-3-ajustes-saldoview.sql, aplicado 2026-11-08)
- [x] T050 Lint compatible con JSX (globals browser/node + ecmaFeatures jsx en `eslint.config.js`) — 0 errores; warnings NaN eliminados; Historial condensado con acciones visibles
- [x] T051 POS: el grid de venta rápida y el dropdown de producto filtran por el estado de la cotización referenciada en la nota del producto (`COT-xxx` → solo `Confirmada`; sin referencia siempre visible). Verificado con captura Playwright: solo aparecen las cotizaciones Confirmadas (0 errores de consola)
- [x] T052 [US6] Verificación del flujo de edición con Playwright (`web/scripts/check-edit-cot012.mjs`): al abrir Editar de una bandeja unitaria, el checkbox, el método "POR UNIDAD", la pieza (nombre+cantidad) y el Precio por unidad guardado se precargan (captura `ui-review/editar-cot012.png`). Root cause del reporte: una segunda edición sin re-marcar la bandeja revirtió la COT-012 a 'total' — restaurada en DB (Árbol navideño ×12, Q12.13/u)
- [x] T053 [US6] Desglose por bandeja (migración 4): col `bandejas_detalle jsonb`; RPCs guardar/editar v4 la persisten; `sumarBandejas` en `pricing.js` (cada fila = una impresión con sus gramos/horas/MO/pintura y ×N repeticiones idénticas); Cotizador: editor de bandejas (agregar/quitar filas, ×N, modo simple alternativo); autocompletado de producto reparte totales entre bandejas. Tests +3 (19/19); verificado con Playwright: 100 + 80×2 = 260 g → Q51.48 material, 7 h → Q17.50, MO 0.75 h → Q21.00 (captura `ui-review/cotizador-bandejas.png`)
- [x] T054 [US6] Regresión del error "cannot get array length of a scalar": migración 5 (`jsonb_a_array` normaliza p_piezas/p_bandejas_detalle llegan como escalar-string) + migración 6 (una sola sobre-carga por RPC: guardar 19 args, editar 22 — PostgREST ya no escoge entre candidatos). Validado end-to-end con Playwright (`regresion-edit-cot012.mjs`): editar COT-012 → guardar sin cambios → precio Q12.13 intacto, hist Q145.56 preservado, total recalculado Q145.57, 0 page-errors
- [x] T055 [US6] Sincronización POS ↔ cotizaciones: los productos ligados a una COT obtienen SIEMPRE nombre/precio del snapshot vigente en DB (`cotizacion.producto` y `precio_venta_final ?? con_factura/total_sin_iva` según factura) en cada montaje; bandejas por unidad se venden solo en la zona PIEZAS (sin duplicados); sin COT ref → catálogo manual. Probado con mutación temporal en DB (Playwright `pos-sync-test.mjs`): POS reflejó "Espada Sync Test · Q350.00" al instante y se revirtió al original
- [x] T056 [US6] Fix combos (migración 7): `registrar_combo` normaliza `p_lineas` con `jsonb_a_array` (el cliente ahora manda array nativo). Validado E2E con Playwright (`regresion-combo.mjs`): combo "Pack Prueba E2E" con 1 pieza COT-012 → **VT-003 Q12.13 registrado** (toast OK), `vendidas` contabilizadas, luego anulado y unidades devueltas (cleanup en `scripts/cleanup-combo.sql`); 0 page-errors
- [x] T057 [US6] Combos guardados (migración 8, tabla `combo_guardado`): al armar un combo, 💾 GUARDAR COMBO (plantilla) lo salva con sus líneas y precio (opcional); aparecen en "🚀 COMBOS GUARDADOS (venta rápida)" con botón 🛒 Vender (1 toque → registrar_combo con la plantilla) y 🗑 eliminar; advertencia visual si falta stock. E2E verificado (VT-008 Q12.13 vendido desde plantilla). Nota operativa: incidente de sobre-limpieza resuelto (ventas VT-004/VT-005 restauradas y `vendidas` rebalanceadas con `scripts/rebalanceo-vendidas.sql` — ver MEJORAS)
- [x] T058 [US6] Edición conservando unidades vendidas (migración 9): `editar_cotizacion` ya NO borra/recrea las piezas — upsert por id/nombre que conserva `vendidas` y borra solo las quitadas sin ventas; reparación de ids colgantes en venta_combo_linea y plantillas (`reparacion-piezas_ids.sql` + `reparar-ids.mjs`); estado restaurado: Árbol navideño 18 · vendidas 3 · disponibles 15, template "pack navideño" re-vinculado. Flujo de repuesto de piezas = editar cantidad en la cotización (vendidas se conservan)
- [x] T059 [US6] Fix "record pz is not assigned yet" (migración 9 v2): variable declarada colISIONABA con alias de tabla en el DELETE — eliminada la variable y alias renombrados; precarga de edición determinista (editarFila persiste + reload; Cotizador lee editStore/sessionStorage al montar y eventos). E2E verificado con Playwright (`test-pzfix.mjs`): crear COT-036 → editar → bandeja multi-pieza Guardar (sin error) → RE-EDITAR precarga presentación/pieza/firebase intacto → limpieza con delete; 0 page-errors
- [x] T060 [US6] Edición POR URL definitiva: `editarFila` navega a `#/cotizador?edit=COT-FOLIO`; el Cotizador lee el folio de la URL y trae TODO desde la DB (datos + piezas, nunca copias entre pantallas — regla "siempre valores guardados en base de datos"); App parseTab ignora query-params (root cause del tab no cambiando en el build de producción). E2E en 4173 (build): login → historial → Editar COT-019 → producto precargado ("Max grinch", nombre vigente en DB) ✓; removed editStore/sessionStorage del flujo
- [x] T061 [US6] Inventario unificado (migración 10): col stock_extra/minimo en cotizacion_pieza + vista piezas_bandeja v3 (disponibles = cantidad+extra−vendidas, alerta con mínimo); Inventario muestra TODAS las piezas con estado; POS filtra Confirmadas en su lado; el catálogo deja de duplicar stock (solo precios)
- [x] T062 [US7] Datos de cliente + seguimiento de pedidos (migración 11): cols cliente_direccion/telefono/estado_pedido/metodo_envio/costo_envio/tracking/notas en venta; RPCs registrar_venta/vender_unidad_bandeja/registrar_combo v2 aceptan cliente opcional + RPC actualizar_pedido; POS: dirección y teléfono opcionales en las 3 zonas de venta; nueva pestaña 🚚 Pedidos (view Seguimiento.jsx) con estados Nuevo→Preparando→Enviado→Entregado, método de envío, costo y tracking. E2E: venta VT-004 con cliente "María López" visible y estado cambiado a Preparando ✓
- [x] T063 [US7] Eliminar pedidos + editar cliente/contacto (migración 12): RPC eliminar_venta (devuelve unidades al inventario y BORRA la venta con sus líneas en cascada) + actualizar_pedido v2 con cliente/dirección/teléfono; vista Pedidos: cliente, dirección y teléfono editables inline (blur = guardar) y botón 🗑 eliminar con confirmación en tabla y tarjetas móviles. E2E: cliente VT-004 editado a "María López (editada)" ✓, venta de prueba VT-TST eliminada por UI ✓ (DB limpia)
- [x] T064 [US7] Desglose de ventas por rubro (migración 13): vista `desglose_ventas` que para cada venta no anulada calcula material/máquina/MO/consumibles/acabado/embalaje (proporcional desde el snapshot de la cotización origen), margen real (= venta − costos − IVA) e IVA. Nueva pestaña 📊 Reportes con: tarjetas de resumen, tabla con barras por rubro, detalle por venta. E2E verificado: 3 ventas → Q235 vendido, Q89.17 costos (37.9%), Q145.83 margen real (62.1%)
- [x] T065 [US7] Materiales múltiples con costo individual (migración 14): col costo_qg en material; col material_usado en cotizacion; consumo_material vista agrupa por material específico; RPCs aceptan p_material (busca costo_qg del material); servicio materiales.js (crear/eliminar/actualizar costo); Inventario: columna "Costo Q/g" editable + formulario "+ Agregar material" (nombre + tipo PLA/Resina + Q/g); Cotizador: dropdown de Material (reemplaza el dropdown Tipo) que muestra cada material con su costo y determina tipo/impresora automáticamente. E2E pendiente de validar visualmente

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: inmediata → T002 → T003 (seed necesita schema)
- **Foundational (2)**: T005→T006 (TDD: tests primero); T007..T010 pueden ir en paralelo tras T001
- **US1 (3)**: requiere Foundational completo
- **US4 (4)**: independiente de US1 (solo necesitas usuario + catálogo semillado); puede paralelizar con US1
- **US2 (5)**: depende de US1 (reutiliza el Cotizador para edición y T014 services)
- **US3 (6)**: independiente en su núcleo (vistas derivadas), pero las cifras del quickstart suponen datos de US1/US4 → secuencial recomendado
- **US5 (7)**: al final (bajo valor, riesgo de romper cálculos si se toca antes)
- **Polish (8)**: después de las historias deseadas

### User Story Dependencies

- US1: Foundational → nada más
- US4: Foundational → nada más (independiente de US1)
- US2: US1 (comparte vista Cotizador y services/cotizaciones)
- US3: opcional-mente integrable con US1+US4 para probar descuentos en vivo; implementable antes si se usa con datos semilla
- US5: cualquiera tras Foundational; junto al final preferido

### Within Each User Story

Vista → service wrapper (si falta) → integración RPC → checkpoint de validación con cifras del quickstart.

### Parallel Opportunities

- Setup: T004
- Foundational: T005+T006 en estricta secuencia TDD; T007/T008/T010 paralelos; T009 después del shell
- Entre historias: US1 ∥ US4 (archivos y pantallas distintos)
- Dentro de US1: T011 ∥ T012; dentro de US2: T019 ∥ T020; US3: T023 primero, luego T024/25/26 en secuencia (mismo archivo view); US5: T027 ∥ T028? no — mismo módulo, secuencial

---

## Implementation Strategy

### MVP First (US1 only)

1. Setup + Foundational
2. US1 → validar con quickstart §US1 (cifras Q314.27 etc.)
3. **STOP — demo al propietario con datos reales** → decidir si aterriza el deploy ya o se agregan US4/…

### Incremental Delivery

- Cada checkpoint que pasa quickstart = demo deployable (Netlify en cada fase desde US1)
- Orden recomendado (1 dev): 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

### Notas

- Cada tarea termina en commit atómico (pausa para revisión del propietario cuando toque SQL)
- La web reemplaza las hojas del Excel una vez validada (spec: operación en paralelo 1 mes antes del apagón)
- Evitar: lógica de precios en JSX (todo por pricing.js), llamadas supabase fuera de services/, secret keys en el cliente



