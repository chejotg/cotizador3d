# Data Model — Cotizador Web

Feature: 001-cotizador-web · Fecha: 2026-11-08

Todas las tablas (excepto `tarifa`) llevan `owner_id uuid not null default auth.uid()` para RLS por propietario. Moneda: `numeric(12,2)`. Gramos/horas: `numeric(10,2)`.

## Entidades

### tarifa (config del negocio — sin owner, lectura para todos los autenticados)

| Campo | Tipo | Reglas |
|---|---|---|
| clave | text PK | único; ej. `pla_qg`, `tarifa_creator5` |
| valor | numeric(12,4) not null | > 0 |
| unidad | text | `Q/g`, `Q/h`, `%`, `factor`, `Q/categoria` |
| nota | text | origen del dato (ej. "Q180/kg oct 2026") |
| updated_at | timestamptz default now() | auditoría |

Valores semilla (fuente: datos/negocio.md): resina_qg 0.27 · pla_qg 0.18 · desperdicio 1.10 · mo_qh 28 · margen 0.40 · iva 0.12 · cons_bandeja 5.10 · cons_trabajo 0.70 · primer_qfig 23.63 · barniz_qfig 15.75 · pinturas_qfig 13.00 · tarifa_saturn4 1.75 · tarifa_saturn3 1.50 · tarifa_creator5 2.50 · embalaje_pequena 6.61 · embalaje_mediana 23.93 · embalaje_grande 47.03.

### cotizacion

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| owner_id | uuid not null default auth.uid() | RLS |
| folio | text unique | `COT-` + lpad(seq,3,'0') — asignado por RPC |
| fecha | date not null default current_date | |
| cliente | text not null default "(por definir)" | |
| producto | text not null | |
| tipo | text check in ('Resina','PLA') | |
| impresora | text check in ('Saturn 4','Saturn 3','Creator 5') | |
| bandejas | int not null default 1 | ≥ 1 |
| gramos | numeric(10,2) not null | ≥ 0 |
| horas_impresion | numeric(10,2) not null | ≥ 0 |
| horas_mo | numeric(10,2) not null | ≥ 0 |
| horas_pintura | numeric(10,2) not null default 0 | ≥ 0 |
| pintado | boolean not null default false | |
| embalaje | text check in ('Ninguno','Pequeña','Mediana','Grande') default 'Ninguno' | |
| factura | boolean not null default false | |
| envio_q | numeric(12,2) not null default 0 | ≥ 0 |
| estado | text check in ('Emitida','Confirmada','Entregada','Cancelada') default 'Emitida' | |
| precio_venta_final | numeric(12,2) | null = usar total calculado |
| hist_total_previo | numeric(12,2) | snapshot del total anterior al editar (comportamiento 'Historial' del Excel) |
| notas | text | |

**Snapshot calculado (por RPC, inmutable salvo edición explícita de entradas):** material_q, maquina_q, mano_obra_q, consumibles_q, acabado_q, embalaje_q (numeric 12,2), subtotal_q, margen_q, total_sin_iva_q, con_factura_q, total_a_cobrar_q, extra_ganado_q.

Transiciones de estado: `Emitida → Confirmada → Entregada`; cualquier estado → `Cancelada` (los resúmenes excluyen Cancelada a menos que se haya facturado — decisión v1: Cancelada solo cambia estado, no movimientos de inventario porque el descuento de material fue real).

### material

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid not null | |
| nombre | text unique | ej. `PLA`, `Resina Sunlu` |
| unidad | text | `g`, `L`, `u`, `pares`, `latas`, `rollos` |
| descontable_por | text check in ('pla','resina', null) | materiales descontados automáticamente por gramos de cotización |
| stock_inicial | numeric(12,2) default 0 | editable (define el inventario inicial del propietario) |
| minimo | numeric(12,2) | umbral de reposición |

Vistas derivadas: `consumo_material` (SUM de gramos en cotizaciones por tipo), `saldo_material` = stock_inicial + entradas − consumo − salidas.

### movimiento_material

| id uuid PK | owner_id | fecha date | material text FK→material.nombre | entrada numeric(12,2) default 0 | salida numeric(12,2) default 0 | nota text |

### producto (catálogo / piezas terminadas)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid not null | |
| nombre | text unique | |
| precio_sin_iva | numeric(12,2) not null | editable |
| nota | text | ej. `COT-015` |
| stock_inicial | int default 0 | piezas ya fabricadas |
| minimo | int default 0 | |

Vistas: `vendidas_producto` (SUM cantidad en `venta` no anulada por nombre), `saldo_producto` = stock_inicial + producción − vendidas − salidas.

### movimiento_producto

| id uuid PK | owner_id | fecha date | producto text FK | entrada int default 0 (producción) | salida int default 0 (manual) | nota text |

### venta

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid not null | |
| folio | text unique | `VT-` + lpad(seq,3,'0') por RPC |
| fecha | date not null default current_date | |
| cliente | text not null default "(mostrador)" | |
| producto | text not null FK→producto.nombre | |
| cantidad | int not null default 1 | ≥ 1 |
| precio_unit | numeric(12,2) not null | congelado al registrar |
| factura | boolean not null default false | |
| anulada | boolean not null default false | anulación lógica (devuelve piezas vía RPC) |

**Snapshot calculado (RPC):** subtotal_q = cantidad × precio_unit; iva_q = factura ? subtotal×0.12 : 0; total_q.

### cotizacion_pieza (migración 2 — bandejas multi-pieza)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid not null | |
| folio | text FK→cotizacion(folio) cascade | bandeja dueña |
| nombre | text not null | unique(folio, nombre) |
| cantidad | int ≥1 | unidades en la bandeja |
| vendidas | int ≥0 | decre(contadas) al vender, devueltas al anular |

cotizacion gana: `es_bandeja boolean`, `metodo_cobro 'total'|'unidad'`, `precio_venta_unidad numeric(12,2)` (solo método unidad: default = total_a_cobrar ÷ Σunidades).

### venta_combo_linea (migración 2 — detalle de combos)

| Campo | Tipo |
|---|---|
| folio_venta | text FK→venta(folio) cascade |
| cot_folio | text — bandeja que aportó |
| pieza_id | uuid FK lógico → cotizacion_pieza |
| unidades | int ≥1 |

Tanto la venta directa de unidad como las líneas de un combo quedan registradas aquí; `anular_venta` devuelve las unidades de todas sus líneas.

Vista `piezas_bandeja`: id, folio, nombre, cantidad, vendidas, **disponibles**, precio_venta_unidad, cliente, fecha (solo método unidad).

## Relaciones

```
material 1──* movimiento_material (por nombre)
producto 1──* movimiento_producto  (por nombre)
producto 1──* venta              (por nombre; precio_unit congela el precio histórico)
tarifa   → leída por RPCs al calcular (clave/valor)
cotizacion → crea consumos derivados (vista), sin FK de consumo
```

## Reglas de validación (transversales)

- números ≥ 0 (excepto saldo que puede ir negativo con marca en UI — regla de negocio del propietario).
- `tipo` + `impresora`: si tipo=PLA → impresora=Creator 5 (v1); si tipo=Resina → Saturn 4/3. RPC valida y rechaza combinación inválida (P0001).
- tarifas: cada `clave` conocida debe existir; RPC falla con mensaje claro si falta (config incompleta).
- venta con producto inexistente → FK reject.

## Modelos de cálculo (idénticos al Excel — fuente: datos/negocio.md)

```
material_q     = gramos × (tipo=Resina ? resina_qg : pla_qg) × desperdicio
maquina_q      = horas_impresion × tarifa_{impresora}
mano_obra_q    = (horas_mo + horas_pintura) × mo_qh
consumibles_q  = tipo=Resina ? bandejas×cons_bandeja + cons_trabajo : 0
acabado_q      = pintado ? primer_qfig + barniz_qfig + pinturas_qfig : 0   [tarifas figura grande;
                                                                           mediano/pequeño por definir]
embalaje_q     = categoría → embalaje_pequena/mediana/grande, 0 si 'Ninguno'
                 (solo aplica con envío o protection pedida — entrega en mano = 0)
subtotal_q     = Σ anteriores
margen_q       = subtotal × margen
total_sin_iva_q= max(subtotal + margen, **cobro_minimo**)              [regla 10 negocio.md]
cobro_minimo   = material_q + 1×mo_qh + consumibles_q   (piso: nunca menos que material +
                 una hora de mano de obra + consumibles)
con_factura_q  = total_sin_iva × (1 + iva)
total_a_cobrar_q = (factura ? con_factura : total_sin_iva) + envio
precio_venta_final = precio_venta_final ?? (factura ? con_factura : total_sin_iva)
extra_ganado_q = precio_venta_final − (factura ? con_factura : total_sin_iva)
```

Nota: no cobrar solo horas de máquina (modelo híbrido); la mano de obra domina el precio — el desglose siempre debe ser visible (regla del negocio, negocio.md §"Modelo de cobro recomendado").

Casos de verificación reales (del Excel): COT-015 → Q314.27 con factura; COT-001 → Q776.96 sin IVA; COT-004 → Q67.56 (10 piezas PLA).
