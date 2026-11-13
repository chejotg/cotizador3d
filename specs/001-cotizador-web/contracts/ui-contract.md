# UI Contract — Cotizador Web

SPA de una página (`web/index.html`), navegación por tabs sin recargas. Moneda GTQ formato `Q#,##0.00`. Idioma español. Paleta heredada del Excel: azul datos, verde calculado, amarillo input, rojo alerta, morado fijo.

## Rutas / pantallas

| Tab | Archivo view | US | Contenido |
|---|---|---|---|
| `#/cotizador` | cotizador.js | 1 | Formulario + cálculo en vivo + guardar |
| `#/historial` | historial.js | 2 | Tabla buscable/filtrable de cotizaciones |
| `#/inventario` | inventario.js | 3 | Materiales + piezas, saldo/entradas/salidas/inicial/mínimo/alerta |
| `#/pos` | pos.js | 4 | Venta nueva + resumen por fecha |
| `#/tarifas` | tarifas.js | 5 | Tabla de tarifas editable |
| `#` | login | — | Email/password del propietario (Supabase Auth) |

## Pantalla Cotizador (US1)

**Entradas** (toolbar amarilla): Fecha (default hoy) · Cliente · Producto · Tipo (Resina/PLA) · Impresora (3 opciones, filtrada por tipo: PLA→Creator 5) · Bandejas (≥1) · Horas impresión · Gramos (resina puede ser ml→g texto opcional; v1 solo gramos) · Horas MO (default 0.25 en FDM según mínimo) · Horas pintura (default 0) · Pintado Sí/No · Embalaje (Ninguno/Pequeña/Mediana/Grande) · Factura Sí/No · Envío Q.

**Salidas en vivo** (verde, `pricing.js` con tarifas traidas de DB al loguear):
Material · Máquina · Mano de obra · Consumibles (0 en FDM) · Acabado · Embalaje · Margen 40% · **TOTAL sin IVA** · **Con factura (IVA)** · **TOTAL a cobrar** (+envío) · Stock resultante de PLA y resina (rojo si la pieza excede el saldo).

**Acción Guardar** → `guardar_cotizacion(...)`: al éxito, muestra el folio asignado (`COT-0XX`) y limpia el formulario (defaults como Excel). Los totales mostrados luego del guardado son los del **snapshot de DB** (confianza única).

**Editar cotización existente**: se entra desde Historial (precarga el formulario), Guardar llama `editar_cotizacion`; si el total cambió, la fila muestra `hist_total_previo` como "Historial: ... cotizó Qxxx".

## Pantalla Historial (US2)

- Columnas: Folio · Fecha · Cliente · Producto · Tipo/Máquina · Gramos · Horas · Estado (badge color: Emitida azul, Confirmada verde, Entregada cyan, Cancelada rojo) · TOTAL sin IVA · Con factura · Precio venta final (editable inline → guarda y recalcula *Extra ganado* en verde ≥0 / rojo &lt;0) · Extra ganado · Estado-select.
- Búsqueda client-side (folio, producto, cliente) + filtro por estado. Ctrl/Cmd+F base nativa también funciona.
- Fila → botón "Editar" → precarga Cotizador.

## Pantalla Inventario (US3)

**Materiales** (14 filas semilla): Ítem · Unidad · Stock inicial (amarillo, editable) · Entradas (movimientos) · Consumido por cotizaciones (auto) · Salidas manuales · **Saldo** (verde; rojo si &lt; 0) · Mínimo (amarillo) · Alerta (`REPOSICIÓN` rojo si saldo ≤ mínimo). Bloque "Consumo por cotización": folio → g resina / g PLA / lavados IPA / provisión FEP / guantes.

**Piezas**: Producto · Producción · Vendidas (auto por ventas no anuladas) · Salidas manuales · Stock inicial (amarillo) · **Saldo** · Mínimo · Alerta. Tabla PRODUCCIÓN (fecha, producto, piezas) y MOVIMIENTOS (fecha, ítem, entrada, salida, nota) debajo (entradas/salidas manuales).

## Pantalla Punto de venta (US4)

**NUEVA VENTA**: Fecha (hoy) · Cliente · Producto (desplegable del catálogo) · Cantidad (1) · Precio unitario (autocompletado desde catálogo, editable) · Factura Sí/No → Subtotal / IVA / **TOTAL** en vivo. Botón **Registrar venta** → `registrar_venta(...)`; muestra `VT-0NN`; limpia y deja la fecha de hoy.

**Resumen por fecha**: fila de HOY automática + filas tipo: Fecha · # ventas · Total sin factura · Total con factura · TOTAL (excluye anuladas). Abajo lista de ventas del día seleccionado con botón anular (confirmación; llama `anular_venta`).

## Pantalla Tarifas (US5)

Tabla `clave · valor editable (amarillo) · unidad · nota`; guarda fila a fila (update direct — tabla sin snapshot dependencies). Encima aviso: "cambiar una tarifa afecta las próximas cotizaciones; los históricos mantienen su snapshot".

## Contrato de cálculo (pricing.js ≡ SQL ≡ Excel)

Fórmulas de `data-model.md`. **Casos verificados** (deben pasar en `node:test` y en la web):

| Entrada | Total esperado | Referencia |
|---|---|---|
| 583 g PLA · 20 h · 6 camas · MO 1.25 h · factura Sí · envío 0 | **Q314.27** | COT-015 (Excel) |
| 720 g resina · 28 h · 4 bandejas · MO 8 h · Grande · sin factura | **Q776.96** | COT-001 |
| 50 g resina · 3 h · MO 1 h · 1 bandeja · sin factura | **Q75.46** | ejemplo negocio.md |
| 200 g PLA · 8 h · MO 0.25 · factura No | **Q72.45** | COT-016 |
| 20.92 g PLA · 1.75 h · MO 0.5 · factura No | **Q31.53** | COT-005 (floor no subvalora órdenes chicas) |

Convención: redondeo a 2 decimales por componente (half-up) antes de sumar; total = suma de componentes redondeados + margen sobre el subtotal redondeado; **piso de cobro mínimo**: si la suma con margen queda por debajo de material + 1 h MO + consumibles, el total sin IVA sube al piso (regla 10, negocio.md) — se muestra el desglose igual.

## Estados de error UI

- Sin conexión a Supabase → banner "Sin conexión: revisa tu red; el formulario conserva sus datos" (solo bloquea Guardar).
- Sesión expirada → redirige a login (v1: simple, sin conservar borradores).
- Errores RPC (AUTH_REQUIRED/VALIDATION_ERROR/NOT_FOUND) → toast con el mensaje tal cual (español/formato ya definido).
