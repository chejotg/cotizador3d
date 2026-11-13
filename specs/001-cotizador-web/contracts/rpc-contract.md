# RPC Contract — Cotizador Web

Funciones Postgres expuestas al browser por `supabase.rpc()` (PostgREST). Todas `SECURITY DEFINER`, `search_path = public`, ejecución solo para `authenticated` (revoke a `public`/`anon`), owner-scoped por `auth.uid()`.

## guardar_cotizacion

```
guardar_cotizacion(
  p_fecha date,             -- null → hoy
  p_cliente text,           -- null/'' → '(por definir)'
  p_producto text,          -- requerido
  p_tipo text,              -- 'Resina' | 'PLA'
  p_impresora text,         -- 'Saturn 4' | 'Saturn 3' | 'Creator 5'
  p_bandejas int,           -- >=1 (default 1)
  p_gramos numeric,         -- >=0
  p_horas_impresion numeric, p_horas_mo numeric, p_horas_pintura numeric,
  p_pintado boolean, p_embalaje text, p_factura boolean,
  p_envio_q numeric         -- >=0
)
→ cotizacion (fila completa con folio COT-NNN y snapshot de totales)
```

- **Asigna folio** transaccionalmente desde `folio_cotizacion_seq` (nunca duplica).
- **Calcula snapshot** dentro de la transacción leyendo `tarifa` (constitución I). Aplica **cobro mínimo**: `total_sin_iva_q = greatest(subtotal+margen, material_q + 1×mo_qh + consumibles_q)` (regla 10 negocio.md).
- **Valida**: tipo PLA→Creator 5; resina→Saturn 4/3 (error `VALIDATION_ERROR: ...`); `envio_q >= 0`; `bandejas >= 1`.
- **Auth**: `AUTH_REQUIRED` si no hay JWT.
- No recalcula si se llama 2×: cada llamada inserta una fila nueva (el idempotente es manual via editar).

## editar_cotizacion

```
editar_cotizacion(p_folio text, ... mismos campos de entrada ..., p_estado text)
→ cotizacion actualizada; guarda en `hist_total_previo` el snapshot anterior.
```

- Recalcula el snapshot (mismo bloque de cálculo).
- Edita solo si el folio pertenece al caller (`owner_id`).

## registrar_venta

```
registrar_venta(
  p_fecha date, p_cliente text,           -- null → hoy / '(mostrador)'
  p_producto text,                        -- FK nombre en producto
  p_cantidad int,                         -- >=1 (default 1)
  p_precio_unit numeric,                  -- null → toma producto.precio_sin_iva
  p_factura boolean                       -- IVA 12% solo si true
)
→ venta (folio VT-NNN, subtotal_q, iva_q, total_q snapshot)
```

- **NOT_FOUND** si producto no existe y no se pasó precio explícito.
- Descuento de inventario: derivado (vista), no escribe filas de consumo.

## anular_venta

```
anular_venta(p_folio text) → void
```

- Devuelve unidades vía `venta_combo_linea` (ver migración 2) y marca `anulada = true`.
- `NOT_FOUND: venta no existe o ya anulada` si no existe / doble anulación.

## migración 2 — bandejas, cobro por unidad y combos (migracion-2-bandejas.sql)

**guardar_cotizacion v2** (defaults conservan el comportamiento anterior):
```
+ p_es_bandeja boolean, p_metodo_cobro ('total'|'unidad'), p_piezas jsonb [{nombre, cantidad}]
→ si es_bandeja: inserta cotizacion_pieza por pieza y, con método 'unidad',
  guarda precio_venta_unidad = round(total_a_cobrar ÷ Σunidades, 2).
```

**editar_cotizacion v2**: + mismos parámetros opcionales; reemplaza la lista de piezas de la bandeja.

**vender_unidad_bandeja(p_cot_folio, p_pieza_id, p_unidades=1, p_precio_unit=null, p_factura, p_fecha, p_cliente) → venta**: lock FOR UPDATE; valida disponibles (cantidad−vendidas); incrementa vendidas; registra `venta_combo_linea` (para devolver en anulación). Precio default = `cotizacion.precio_venta_unidad`.

**registrar_combo(p_nombre, p_lineas jsonb, p_precio_unit=null, p_factura, p_fecha, p_cliente) → venta**: valida todas las líneas (lock); precio default = Σ(precio unidad × unidades); crea la venta (producto = nombre del combo, cantidad 1), registra líneas y descuenta vendidas — todo en una transacción.

## migración 3 — eliminar cotizaciones, POS solo Confirmadas, precio por unidad manual

**eliminar_cotizacion(p_folio) → void**
- Verifica ownership (`AUTH_REQUIRED` si no) y existencias: si la bandeja ya tiene `vendidas > 0` → `VALIDATION_ERROR: la cotizacion tiene N unidades vendidas; anula esas ventas primero`.
- `DELETE cotizacion` → cascade de `cotizacion_pieza` (sin ventas atadas, no hay líneas).

**guardar_cotizacion / editar_cotizacion v3**: + `p_precio_venta_unidad numeric` — si el propietario definió el precio unitario a mano, ese valor manda; si no, se conserva el sugerido (total_a_cobrar ÷ Σunidades).

**vista piezas_bandeja v2**: ahora expone `estado` y `metodo_cobro`; el POS consulta `.eq("estado","Confirmada")` — Emitidas todavía no se venden y Canceladas nunca se muestran.

## Convenciones de error

| prefijo | significado | HTTP aprox |
|---|---|---|
| `AUTH_REQUIRED` | sin JWT | 401 |
| `VALIDATION_ERROR: ...` | campo/valor inválido | 422 |
| `NOT_FOUND: ...` | folio/producto inexistente | 404 |

Nunca elevar SQLSTATE 40001/40P01 para errores de negocio (PostgREST los reintaría infinitamente — riesgo documentado por Supabase).

## Contrato de precisión numérica

- Redondeos a 2 decimales **solo al final** de cada componente (round half-up como Excel `0.00`).
- Retornos `numeric(12,2)` predicables caso a caso (ver ui-contract.md).
