# Feature Specification: Cotizador Web (web estática + Supabase)

**Feature Branch**: `001-cotizador-web`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "necesito una web estatica conectada a supabase para generar cotizaciones, controlar inventario, gestionar ventas"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar un trabajo (Priority: P1)

El propietario abre la web, llena el formulario de cotización (producto, tipo de impresión Resina/PLA, impresora, bandejas/camas, gramos o ml, horas de impresión, horas de mano de obra, horas de pintura, pintado Sí/No, categoría de embalaje, factura Sí/No, costo de envío) y el browser calcula todos los componentes con las tarifas de la base de datos (material × factor de desperdicio, tarifa/h de máquina, Q28/h mano de obra, consumibles por bandeja, acabado, embalaje, margen 40%, IVA 12%). Al guardar, la cotización se persiste en Supabase con folio correlativo (COT-0XX) y queda en el historial.

**Why this priority**: es el motor del negocio; sin cotizaciones nada más tiene sentido. Este slice solo es viable con tarifa + historial mínimos.

**Independent Test**: abrir la web, cotizar una pieza con datos de ejemplo (ej. 583 g PLA, 20 h, 6 camas, factura Sí) y verificar que el total con factura ≈ Q314.27 (valores medidos reales del negocio) al guardar aparece en el historial.

**Acceptance Scenarios**:

1. **Given** tarifas cargadas en Supabase, **When** lleno el formulario y presiono Cotizar, **Then** veo el desglose (material, máquina, mano de obra, consumibles, acabado, embalaje, subtotal, margen, total sin IVA, con factura, a cobrar).
2. **Given** una cotización calculada, **When** presiono Guardar, **Then** se persiste con folio COT-0XX correlativo, fecha de hoy y estado "Emitida", y aparece en la lista del historial.
3. **Given** una cotización guardada, **When** edito cualquier dato de entrada, **Then** los totales se recalculan y el historial queda actualizado con historial (valor previo) en la cotización.
4. **Given** un precio de venta final manual (venta más cara), **When** lo ingreso, **Then** el campo "extra ganado" muestra la diferencia y se guarda.

### User Story 2 - Buscar y administrar cotizaciones (Priority: P2)

En el historial el propietario busca cotizaciones por folio/producto/cliente/estado, las edita, cambia el estado (Emitida → Confirmada → Entregada / Cancelada) y fija el precio de venta final.

**Why this priority**: sirve para el seguimiento diario de pedidos; depende de US1 para tener datos.

**Independent Test**: guardar 3 cotizaciones, filtrar por folio y por estado, editar una y verificar persistencia en Supabase.

**Acceptance Scenarios**:

1. **Given** N cotizaciones guardadas, **When** escribo "COT-015" o parte del nombre de producto en el buscador, **Then** solo quedan visibles las coincidencias (client-side, sin recargar).
2. **Given** una cotización "Emitida", **When** cambio el estado a "Confirmada", **Then** se guarda y queda diferenciada visualmente (color).

### User Story 3 - Controlar inventario (materiales y piezas) (Priority: P2)

Dos inventarios: **materiales** (resina g, PLA g, IPA L, FEP, guantes, consumibles de embalaje y pinturas) y **piezas terminadas** (productos listos para vender). Consumo automático: al guardar una cotización se descuentan los gramos/projectos de material; al registrar una venta se descuentan las piezas vendidas. El propietario define stock inicial, registra entradas (compras/producción) y ve alertas de reposición cuando el saldo baja del mínimo.

**Why this priority**: evita quedarse sin material y saber qué piezas hay listas para vender; depende de US1/US4 para los descuentos automáticos.

**Independent Test**: definir stock inicial 10,000 g PLA, guardar una cotización de 583 g → saldo 9,417 g; registrar venta de 1 pieza con existencias 2 → saldo 1; sistema alerta si llega al mínimo.

**Acceptance Scenarios**:

1. **Given** stock inicial cargado, **When** guardo una cotización de X gramos, **Then** el saldo del material baja automáticamente por X (con factor real medido).
2. **Given** una venta registrada, **When** se guarda, **Then** la cantidad vendida se descuenta del inventario de esa pieza.
3. **Given** saldo ≤ mínimo, **When** abro la hoja de inventario, **Then** el ítem se marca como "REPOSICIÓN" en rojo.

### User Story 4 - Punto de venta y registro de ventas (Priority: P1)

El propietario registra ventas de productos listos (catálogo con precio sin factura y con factura IVA 12%): eligie producto, cantidad, factura Sí/No → el total se calcula; al guardar se persiste con número VT-NNN, se descuenta del inventario de piezas, y se alimenta un resumen diario (total del día, sin factura y con factura, número de ventas) y mensual.

**Why this priority**: punto de cobro diario del negocio; lleva estados de caja diaria. Dependencia mínima: catálogo y registro de ventas.

**Independent Test**: registrar 3 ventas hoy (una con factura) → ver VT-001..003, resumen del día con montos correctos, sin factura + con factura = total.

**Acceptance Scenarios**:

1. **Given** un catálogo con productos, **When** elijo producto y cantidad y registro la venta, **Then** se guarda con folio VT-NNN, subtotal, IVA y total calculados server-side de las tarifas (IVA solo si factura Sí).
2. **Given** ventas en varios días, **When** abro el resumen por fecha, **Then** la fila de hoy aparece automáticamente con totales del día; escribiendo otra fecha aparecen esos totales también.
3. **Given** una venta guardada por error, **When** la anulo, **Then** deja de contar en los resúmenes y devuelve las piezas al inventario.

### User Story 5 - Administrar tarifas y catálogo (Priority: P3)

El propietario (responsable único) mantiene las tarifas del negocio en un solo lugar editable: precio resina/PLA por gramo, factor de desperdicio, Q/h de mano de obra, tarifa por máquina (Saturn 4/Saturn 3/Creator 5), consumibles, acabado (primer/barniz/pinturas), tarifas de embalaje por categoría, margen e IVA. Cambiar una tarifa recalcula futuras cotizaciones (las históricas mantienen… conforme lo decidido) y el catálogo de productos de venta con precios.

**Why this priority**: mantenimiento; las tarifas vienen precargadas del negocio real; se toca 1-2 veces al mes.

**Independent Test**: cambiar el margen a 45% y cotizar de nuevo → nuevo total refleja el margen nuevo; guardar y verificar recalculo.

**Acceptance Scenarios**:

1. **Given** tarifas precargadas, **When** edito el precio del PLA, **Then** la próxima cotización PLA recalcula con el valor nuevo.
2. **Given** un catálogo de productos, **When** agrego/edito un producto con su precio, **Then** aparece en el punto de venta y en el inventario de piezas.

### User Story 6 - Bandejas multi-pieza y combos (Priority: P1 — agregada 2026-11-08)

Las impresiones se agrupan por **bandeja** (placa de resina o cama FDM) con **múltiples piezas**: la cotización se hace de la bandeja completa (gramos/horas totales) y el propietario elige si la vende **en total** (un cliente compra la bandeja) o **por unidad** (precio unitario sugerido = total ÷ Σpiezas). Con las piezas vendidas por unidad puede luego armar **combos** mezclando piezas de distintas bandejas ya cotizadas y venderlos con precio propio (default: suma de los precios por unidad). Las unidades se controlan automáticamente (se descuentan al vender, vuelven al anular).

**Acceptance Scenarios**:

1. **Given** una bandeja con 4 piezas distintas cotizada en Q400, **When** elijo "por unidad", **Then** el sistema sugiere Q100/pza y guarda `precio_venta_unidad` + las piezas con sus cantidades.
2. **Given** piezas disponibles de varias bandejas, **When** armo un combo con 2 de una y 1 de otra y lo registro, **Then** se genera VT-NNN, se descuentan las unidades de cada bandeja y queda registro de las líneas del combo.
3. **Given** una venta de unidad/combo anulada, **When** se anula, **Then** las unidades vuelven a estar disponibles.

### Edge Cases

- *¿Qué pasa con gramos/válidas fuera de rango o vacíos?* → formulario validado client-side: números ≥ 0, campos requeridos claros.
- *¿Qué pasa si Supabase no responde?* → aviso de "sin conexión, revisa tu red" y los datos no se pierden (cola local hasta reconectar).
- *¿Qué pasa si dos cotizaciones se guardan a la vez?* → el folio se asigna transaccionalmente (restricción única en base de datos) para nunca duplicar.
- *¿Acceso?* → la web es de uso privado (1 usuario): Supabase Auth email único + RLS; sin roles múltiples por ahora.
- *¿Qué pasa si el stock queda negativo?* → se permite con marca roja explícita (no hard-block) porque el propietario elige; nunca en silencio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-1**: Cotizador calcula componentes EXACTAMENTE con el modelo de cobro actual del negocio (material × factor 1.10; máquina por tarifa de impresora; mano de obra Q28/h; consumibles Q5.10/bandeja + Q0.70 solo en resina; acabado primer+barniz+pinturas si pintado; embalaje por categoría Pequeña/Mediana/Grande **solo si hay envío o el cliente pide protección** — entrega en mano = Q0; margen 40%; IVA 12% solo con factura; envío passthrough; **cobro mínimo**: el total sin IVA nunca baja de material + 1 h de mano de obra + consumibles — regla 10 de datos/negocio.md) — ver business rules de `datos/negocio.md`, este proyecto los consolida.
- **FR-2**: Folios correlativos únicos COT-NNN y VT-NNN con transacción en Supabase.
- **FR-3**: Historial con filtro/búsqueda, edición in-place, estados (Emitida/Confirmada/Entregada/Cancelada), precio de venta final y "extra ganado".
- **FR-4**: Inventario dual: materiales y piezas con stock inicial editable, entradas/salidas, mínimos, consumo automático por cotización/venta y alerta de reposición.
- **FR-5**: Punto de venta con catálogo, cálculo total según factura y resumen diario/mes.
- **FR-6**: Web estática (SPA) sin backend propio: Supabase (Postgres + Auth + opcional Realtime) desde el browser con anon key + RLS.
- **FR-7**: Uso autorización por email del propietario (Supabase Auth), datos privados por RLS (una cuenta).
- **FR-8**: Persistencia consistente con los archivos de datos actuales: copiar las tarifas reales del negocio (valores 2026) y las 18 cotizaciones históricas (COT-001..018) como datos semilla.
- **FR-9**: Responsive (uso en celular/laptop del propietario), 100% en español, moneda GTQ (Q).

### Key Entities *(include if feature involves data)*

- **tarifa** (tabla config): nombre, valor numérico, unidad — incluye: resina_qg (0.27), pla_qg (0.18), desperdicio (1.10), mo_qh (28), margen (0.40), iva (0.12), cons_bandeja (5.10), cons_trabajo (0.70), primer (23.63), barniz (15.75), pinturas (13), tarifa_saturn4 (1.75), tarifa_saturn3 (1.50), tarifa_creator5 (2.50), embalaje_pequena (6.61), embalaje_mediana (23.93), embalaje_grande (47.03).
- **cotizacion**: folio, fecha, cliente, producto, tipo (Resina/PLA), impresora, bandejas, gramos, horas_imp, horas_mo, horas_pintura, pintado, embalaje, factura, envio_q, estado, precio_venta_final, created_at. Totales calculados (material, máquina, MO, consumibles, acabado, embalaje, subtotal, margen, total_sin_iva, con_factura, total_a_cobrar, extra_ganado) — se almacenan (snapshot) para mantener estables históricos si cambian las tarifas.
- **probe_material**: nombre, unidad, stock_inicial, mínimo, entradas acumuladas por movimientos; consumos automáticos de cotizaciones y ventas.
- **producto** (catálogo/piezas): nombre, precio_sin_iva, nota, stock_inicial, mínimo; consumo por ventas.
- **venta**: folio VT-NNN, fecha, cliente, producto, cantidad, precio_unit, factura, subtotal/iva/total snapshot, estado (válida/anulada).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-1**: cotizar una pieza con datos reales medidos reproduce el total del Excel actual ± Q0.05 (ej.: Espada Maestra Q314.27 con factura).
- **SC-2**: crear una cotización completa toma < 60 segundos con autocompletado del catálogo de piezas medidas.
- **SC-3**: el saldo de inventario refleja manual + descuentos automáticos sin discrepancia > 1 en piezas / > 1 g? en materiales.
- **SC-4**: resumen diario de ventas cuadra con el total de las ventas del día 100% de las veces.
- **SC-5**: cargar (load) de la web < 3 segundos en conexión 4G (assets estáticos en CDN/desplegable gratis).
- **SC-6**: propietario puede registrar venta, cotización e inventario desde el celular (responsive).

## Assumptions

- Un solo usuario (propietario); cuenta/email privado en Supabase Auth.
- Despliegue gratuito (Netlify/Vercel/GitHub Pages) + plan gratuito de Supabase.
- Las 18 cotizaciones históricas se importan como data semilla conservando los totales snapshot.
- Resina solo se ingresa en gramos en v1 (la conversión ml→g con densidad 1.1 g/ml queda para v2).
- Acabado de piezas pintadas aplica las tarifas de **figura grande** (primer/barniz/pinturas); el valor para medianas/pequeñas está **por definir** en datos/negocio.md → v1 usa las tarifas grandes y lo señala en la UI.
- Sin integraciones externas en v1 (sin pasarelas de pago, no multimoneda); envío se ingresa manual.
- El Excel actual sigue siendo respaldo hasta que la web se valide (paralelo 1 mes).

## Dependencies & Constraints

- Supabase como único backend (Postgres, Auth, RLS) — sin servidor propio.
- Tarifas/valores provienen de `datos/negocio.md` (fuente actual del negocio).
- Sin presupuesto de infraestructura: stack 100% gratuito.


