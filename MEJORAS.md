# Log de errores y mejoras

Registro de errores cometidos y mejoras identificadas, para no repetirlos.

## 2026-10-24 — Feché todos los documentos con el día equivocado

- **Qué pasó:** todos los registros de la sesión (cotizaciones, datos, log) se fechó como 2026-10-04 cuando la fecha real es 2026-10-24. Detectado al generar catalogo.xlsx (la marca de tiempo del archivo lo reveló).
- **Por qué:** asumí la fecha en vez de verificarla contra el entorno.
- **Cómo evitarlo:** verificar SIEMPRE la fecha real del sistema antes de fechar documentos nuevos; fechar con la fecha del día de cada registro, no con la del inicio de sesión. Corregido en bloque en todos los .md.

## 2026-10-24 — Edit borró filas de una tabla sin querer

- **Qué pasó:** al editar la tabla de gastos de `datos/negocio.md` para actualizar filas de embalaje, el bloque `oldString` incluyó más filas de las que se querían cambiar y las filas de Repuestos, Envío y Mano de obra se borraron. Se restauraron con una segunda edición.
- **Por qué:** el bloque de reemplazo no contenía todas las líneas del original.
- **Cómo evitarlo:** al editar tablas, incluir en el `oldString` solo las filas que cambian y verificar el resultado completo de la tabla después de editar.

## 2026-10-24 — Usar siempre costo local real, no precio de lista internacional

- **Qué pasó:** calculé la tarifa de máquina de la FlashForge Creator 5 con su precio de lista internacional ($699 ≈ Q5,340), pero el propietario la compró en Guatemala por **Q8,099** — la depreciación real es Q0.81/h, no Q0.53/h. Ya había pasado lo mismo con la pantalla LCD (lista $130 vs Q1,800 local).
- **Por qué:** los equipos importados a Guatemala cuestan ~30–50% más que el precio de lista por envíos/aduana/márgenes locales; valorar en dólares lista subestima el costo real.
- **Cómo evitarlo:** al registrar cualquier equipo o repuesto, preguntar/verificar el costo local real pagado y usarlo como base de amortización. Nunca convertir el precio de lista directamente.

## 2026-10-24 — Descalifiqué Firebase sin verificar novedades

- **Qué pasó:** en el análisis de BD para el cotizador descalifiqué Firebase argumentando "Firestore es NoSQL", cuando el usuario mencionó Firebase SQL Connect. Verifiqué: desde abril 2026 Firebase Data Connect es SQL Connect (PostgreSQL real vía Cloud SQL, SDK Flutter oficial, offline caching).
- **Por qué:** apliqué mi conocimiento desactualizado del ecosistema sin verificar el estado actual antes de afirmar.
- **Cómo evitarlo:** al evaluar servicios cloud/tech, verificar su estado actual (websearch/Context7) ANTES de afirmar que una opción no sirve — los productos evolúan trimestralmente.

## 2026-10-24 — Cálculo de cotización mezcló subtotales de tarifas distintas

- **Qué pasó:** en los ejemplos de "Bowsette pintada" se usó el subtotal de la tarifa de mano de obra vieja (Q25/h → Q416.28) como base para recalcular con Q28/h, produciendo totales inconsistentes (Q748.66, Q784.88, Q1,048) en el chat. El correcto con Q28/h: base sin pintar Q446.28; pintada Q778.66 → total Q1,090.13.
- **Por qué:** recalcular encadenando sobre números de un mensaje anterior en vez de recomponer desde los componentes.
- **Cómo evitarlo:** al cambiar cualquier tarifa, recomputar la cotización desde los componentes (resina, máquina, labor, consumibles, embalaje), no sumar ajustes sobre el subtotal anterior. Registrado también como regla en datos/cotizaciones.md.

## 2026-10-24 — Consumibles fijos por trabajo subvaluaban piezas multi-bandeja

- **Qué pasó:** el modelo de cobro fijaba consumibles (IPA+FEP+guantes) como Q5.80 por trabajo, pero una figura de 4 bandejas usa 4 pares de guantes, 4 lavados y 4 láminas de FEP.
- **Por qué:** se calculó el consumible con una bandeja única como referencia.
- **Cómo evitarlo:** consumibles por bandeja (Q5.10) + fijo por trabajo (Q0.70). Detectado con la primera pieza real (He-Man, 4 bandejas).

## 2026-10-31 — Fórmula de Excel con autorreferencia circular

- **Qué pasó:** en el generador de `datos/cotizador.xlsx`, la fórmula "TOTAL a cobrar (+ envío)" del cotizador sumaba `$C$29` (la propia celda del resultado) en lugar de `$C$16` (el campo de envío), lo que habría creado una referencia circular al abrir el archivo.
- **Por qué:** desalineación entre la numeración de filas de los campos de entrada (C3–C16) y las filas de resultados (C19–C30) al escribir la fórmula a mano.
- **Cómo evitarlo:** al escribir fórmulas de Excel en hojas tipo formulario, verificar cada referencia contra el mapa real de celdas (entradas vs resultados) y probar el archivo generado leyéndolo de vuelta antes de entregarlo.

## 2026-10-31 — Código de estilo agregado después de writeFile

- **Qué pasó:** al agregar colores/diseño al generador de `cotizador.xlsx`, coloqué todo el bloque de estilos después de la llamada a `writeFile`, que no se habría ejecutado (los estilos no se aplicarían al archivo).
- **Por qué:** inserté el código nuevo al final del script sin revisar dónde termina el flujo de ejecución.
- **Cómo evitarlo:** al editar scripts, revisar la estructura completa antes de insertar bloques; la escritura/serialización del archivo debe ir SIEMPRE al final.

## 2026-10-31 — PowerShell y COM de Excel: ()calls y encoding

- **Qué pasó:** dos fallos al instalar macros vía COM: (1) `powershell.exe` 5.1 leyó mal los acentos del script (`UTF-8` sin BOM) rompiendo las cadenas; (2) en pwsh, `Worksheet.Buttons` y `Buttons.Add` son métodos COM, y `$ws.Buttons.Add(...)` falló ("PSMethod does not contain Add") — hay que llamarlos como `($ws.Buttons()).Add(...)`.
- **Por qué:** late binding de COM en PowerShell ejecuta propiedades-método con paréntesis, y PS 5.1 asume ANSI sin BOM.
- **Cómo evitarlo:** ejecutar scripts con acentos solo con pwsh o guardar con BOM; al invocar métodos COM de Excel (Buttons, Names, Timer...), verificar si son propiedad o método y usar `(x.Prop()).Metodo(...)`. Evitar acentos en captions de botones.

## 2026-10-31 — Helpers de estilo usados antes de declararse (TDZ)

- **Qué pasó:** al agrandar la hoja Stock en el generador se usaron `fillSolid`/`bordersAll` en la sección de construcción, pero estaban declarados `const` más abajo (en el bloque de diseño) → `ReferenceError: Cannot access before initialization`.
- **Por qué:** los helpers de estilo conviven con el código de diseño en la parte baja del script, pero ya se necesitan arriba.
- **Cómo evitarlo:** declarar funciones/ayudas compartidas al inicio del script, nunca intercaladas con el bloque donde se usan por primera vez.

## 2026-10-31 — Mover código con String.IndexOf dejó líneas corruptas

- **Qué pasó:** para mover `const pvProductos` arriba usé un script ad-hoc con IndexOf/Remove que dejó una línea basura (`const wi = ...`) dejando el archivo sin sintaxis válida; también moví el uso de `prodStart` sin mover su declaración (TDZ otra vez).
- **Por qué:** manipular código fuente con regex/string surgery es frágil y no se autorevisa.
- **Cómo evitarlo:** mover bloques de código SIEMPRE con ediciones manuales (leer → borrar → insertar en destino), no con scripts; después de mover cualquier bloque, verificar que las declaraciones existan anTES de sus usos y correr el script inmediatamente.

## 2026-10-31 — CRÍTICO: regenerar el Excel borró cotizaciones guardadas por el usuario

- **Qué pasó:** al regenerar `cotizador.xlsx`/`cotizador.xlsm` desde la plantilla, se reemplazó el archivo completo y se perdieron las cotizaciones que el propietario había guardado desde Excel (COT-019+), además de ventas/e,inventario y todo dato operativo. También quedé procesos Excel huérfanos que bloquearon corridas posteriores y fallas "Insufficient memory" al nombrar el módulo VBA tras pegar las data migrada (resuelto inyectando macros ANTES de migrar).
- **Por qué:** el generador crea la plantilla de cero y el instalador sobreescribía el xlsm sin extraer primero la data del archivo vivo; violé la advertencia del propio AGENTS.md ("exportar datos primero si se edita a mano").
- **Cómo evitarlo:** (1) NUNCA ejecutar `gen-cotizador-xlsx.js` + `instalar-botones.ps1` sin el paso de migración que ya está integrado en el instalador — abre el xlsm previo, copia por rango los datos del usuario (mapa de rangos en instalar-botones.ps1) al nuevo template y solo entonces lo reemplaza. (2) Si cambia el LAYOUT del Excel (posiciones de rangos), actualizar el mapa de migración ANTES de regenerar. (3) Siempre matar procesos Excel invisibles huérfanos (MainWindowHandle==0) antes de operar con COM. (4) Validaciones de ExcelJS que apuntan a rangos deben llevar prefijo '=' en formulae.

## 2026-11-08 — El diseño de la web omitió el cobro mínimo de datos/negocio.md

- **Qué pasó:** al diseñar pricing/spec de `001-cotizador-web`, el modelo calculado cubría casi todo `datos/negocio.md` pero omitió la **regla 10 (cobro mínimo: material + 1 h de MO + consumibles)**; el propietario lo detectó al revisar el plan.
- **Por qué:** extraje las reglas de negocio leyendo con detalle solo la sección "Modelo de cobro recomendado" y los componentes; los ítems numerados finales (10. Cobro mínimo) se quedaron fuera del modelo de datos.
- **Cómo evitarlo:** al diseñar contra archivos de memoria, extraer la lista COMPLETA de componentes numerados (1..N) con un checklist línea por línea, no solo lo recordado de la lectura; anotar los pendientes/por-definir (p. ej. acabado mediano/pequeño) como assumptions explícitos de la spec.

## 2026-11-08 — Implementación inicial de la web: dos fallos atrapados por el build

- **Qué pasó:** (1) `web/src/format.js` se auto-importaba y reexportaba `redondeo2` (referencia circular consigo misma) → Rollup abortó el build; (2) el schema SQL se escribió primero en `contracts/` de la raíz en vez de `specs/001-cotizador-web/contracts/`.
- **Por qué:** reutilicé sin pensar el nombre del símbolo entre módulos y llamé al escribir con ruta relativa al cwd equivocado.
- **Cómo evitarlo:** cada símbolo vive en su módulo propio (format → formateo, pricing → cálculo); usar SIEMPRE rutas absolutas del proyecto al escribir archivos nuevos; correr `npm run build` + `npm run test` + `npm run lint` después de cada lote de archivos.

## 2026-11-08 — CSS sticky con alturas fijas causaba superposición

- **Qué pasó:** los `th` de tablas tenían `position: sticky; top: 57px` calculado con la altura "esperada" del header; cuando el header se envuelve a dos líneas (ancho medio/móvil), el header real es más alto y el `th` pegajoso se superponía a filas y ocultaba opciones — el propietario reportó "elementos superpuestos y opciones que no se ven".
- **Por qué:** alturas fijas asumidas en CSS sticky son frágiles con layouts responsivos.
- **Cómo evitarlo:** no anclar con `top` en px a un elemento de altura variable; si se necesita sticky, usar contenedor con scroll propio o dejarlo estático. También: secciones importantes nunca enterradas al final de columnas largas (POS bandejas/combos ahora full-width) y `<details>` de contenido operativo abiertos por defecto.

## 2026-11-08 — Vistas de SQL divergentes del código (columna faltante → HTTP 400)

- **Qué pasó:** el frontend pidió `stock_inicial` en la vista `saldo_material` y luego `alerta`/`stock_inicial` en `saldo_producto`, pero dichas vistas SQL no las exponían — listas de select con HTTP 400 silenciosos en consola. Además, al recrear la vista me olvidé por el camino la columna `alerta` (segunda ronda de 400).
- **Por qué:** la vista y el select del cliente se editaron por separado sin checar el contrato de columnas entre ambos; y al reemplazar la vista copié de memoria el bloque anterior.
- **Cómo evitarlo:** cuando cambies una vista de DB, actualizar el archivo `contracts/*` en la MISMA edición y verificar el select del cliente contra la vista con una consulta `select ... limit 1` real antes de dar por corregido; al reemplazar vistas SQL, copiar el bloque EXACTO del archivo y agregar solo la columna nueva.
- **Instrumento:** Playwright + `debug-net.mjs` ahora lista todos los HTTP ≥400 con su snippet — usarlo tras cualquier cambio de vista/servicio.

## 2026-11-08 — Sobre-limpieza de datos de prueba tocó ventas reales

- **Qué pasó:** al limpiar ventas de prueba E2E usé un like '%E2E%' y resultados agregados, y terminé anulando ventas reales del propietario (VT-004 "Pack Navideño" y VT-005 "Árbol navideño") y una divisible de vendidas desalineada. Se restauraron (anulada=false) y las 'vendidas' se re-equilibraron recalculando desde las ventas vigentes con `scripts/rebalanceo-vendidas.sql`.
- **Por qué:** identifiqué datos de prueba por patrones genéricos en vez de por folios exactos que yo misma creé.
- **Cómo evitarlo:** el cleanup de aprendizas/tests SOLO debe tocar folios exactos creados por el test (registrarlos primero: guardar venta folio en variable, revertir ese folio y su venta_combo_linea). Al tocar `vendidas`/inventario manualmente, recalcular SIEMPRE desde la fuente (ventas vigentes) en vez de restar estimaciones.

## 2026-11-08 — Re-guardar una cotización reseteaba las unidades vendidas

- **Qué pasó:** al editar la COT-012 (para ajustar la cantidad de piezas), el RPC `editar_cotizacion` borraba y recreaba las `cotizacion_pieza`: las `vendidas` volvían a 0 (el POS mostraba "18 disponibles" desde cero) y los IDs de pieza cambiaban, rompiendo las líneas de `venta_combo_linea` y de las plantillas de combo ("sin suficiente stock de piezas").
- **Por qué:** la edición implementaba las piezas como DELETE+INSERT completo sin preservar el estado de ventas de cada pieza.
- **Cómo evitarlo:** editar piezas con UPSERT por id (o nombre) conservando `vendidas`; borrar solo piezas quitadas que no tengan ventas; si cambia el id de una pieza, remapear `venta_combo_linea` y `combo_guardado.lineas` (migración 9 + scripts de reparación). Al hacer repuestos de piezas de bandeja, el flujo correcto es editar la CANTIDAD de la pieza en la cotización — el formulario PRODUCCIÓN aplica solo al catálogo/materiales.

## 2026-11-08 — PL/pgSQL: variable declarada con mismo nombre que alias de tabla ("record pz is not assigned yet")

- **Qué pasó:** en `editar_cotizacion` (migración 9) declaré `pz record` sin usarlo, y el DELETE dentro de la función usaba `pz` como ALIAS de la tabla `cotizacion_pieza` — PL/pgSQL resolvió `pz.*` hacia la variable no asignada → "record pz is not assigned yet" al editar cualquier cotización.
- **Por qué:** colisión de nombres variable-alias; PL/pgSQL gana la variable sobre la columna/alias.
- **Cómo evitarlo:** nunca declarar variables que coincidan con aliases/identificadores SQL usados en el cuerpo; al crear funciones, nombrar records con prefijos claros (v_*) y dejar los alias de tabla sin colisionar. Reproducir el error ANTES de entregar: crear/Editar una cotización de prueba por UI (Playwright) tras cada cambio de RPC.
- Además: el Editar→Cotizador transportaba datos por sessionStorage con carrera (hashchange vs montaje) — ahora la precarga de edición es determinística: `editarFila` persiste la data y hace `location.reload()`, y el Cotizador montado la lee limpio (ver `Historial.editarFila`).

## 2026-11-08 — RPCs jsonb: escalares vs arrays y sobre-cargas ambiguas

- **Qué pasó:** dos errores al editar bandejas: (1) `cannot get array length of a scalar` — supabase-js envió `p_piezas`/"`p_bandejas_detalle`" como string y PostgREST lo recibió como jsonb-escalar; (2) "Could not choose the best candidate function" — al editar una cotización SIN desglose (no se envía `p_bandejas_detalle`), PostgREST encontraba 2+ sobre-cargas compatibles del RPC.
- **Por qué:** asumí que strings JSON se paraban a arrays automáticamente (no siempre: jsonb param + string = escalar), y acumulé sobre-cargas de functions con defaults iguales que son indistinguibles cuando args opcionales se omiten.
- **Cómo evitarlo:** (1) en RPCs con parámetros jsonb, normalizar SIEMPRE la entrada con un helper (`jsonb_a_array`) tolerante a string/array/null antes de `jsonb_array_length`; (2) crear UNA sola firma por RPC — castrar todas las sobre-cargas con un DO contra pg_proc al final de la migración; (3) en el cliente, pasar arrays JS nativos, no JSON.stringify. (Notario: el mismo patrón golpeó a `registrar_combo` (migración 7) — aplicado el fix a TODOS los RPCs que reciben jsonb, no solo al primero que lo reportó.)

## 2026-11-10 - Router de hash no reconocFa parametros (?edit=...) en build de produccion

- **Qu pao:** el flujo Editar funcionaba en el dev server pero NO en el build final: `#/cotizador?edit=COT-019` era un "tab" desconocido para `useTab`, as que la App permaneca en Historial y el Cotizador jams se montaba.
- **Por qu:** el parser comparaba el hash completo (con query) contra la lista de tabs; en dev mis tests usaban sessionStorage/otra ruta y no pasaban por aqu.
- **Cmo evitarlo:** al agregar parmetros a rutas de hash, actualizar el parser del router (separar el "tab" del query `split("?")[0]`) y probar SIEMPRE el build de produccin (`vite build` + `vite preview`), no solo el dev server.

## 2026-11-10 - Cotizaciones Confirmadas sin producto en el catlogo del POS

- **Qu pas:** el usuario cre COT-040 y la confirm, pero no apareca en el POS porque las cotizaciones nuevas no crean automticamente su fila en la tabla `producto` (el catlogo del POS). Solo las cotizaciones del seed original tenan su producto.
- **Por qu:** no exista el vnculo entre "confirmar cotizacin" y "crear producto en catlogo".
- **Cmo evitarlo:** trigger en DB (`trg_cot_confirm_producto`) que auto-crea/actualiza el producto cuando una cotizacin pasa a Confirmada. Adems, repair script para las 5 cotizaciones Confirmadas sin producto.

## 2026-11-10 - RPCs no incluan stock_extra en el clculo de disponibles

- **Qu pas:** al vender 2 pack navideos, el RPC `registrar_combo` rechaz la venta diciendo "sin suficiente stock" aunque las piezas tenan 5 disponibles. El RPC calculaba disponibles como `cantidad - vendidas` SIN incluir el `stock_extra` que el usuario haba agregado desde Inventario. La vista `piezas_bandeja` s lo inclua pero los RPCs no.
- **Por qu:** el clculo de disponibles se implement dos veces (una en la vista para mostrar, otra en los RPCs para validar) y solo la vista tena el `stock_extra`.
- **Cmo evitarlo:** el clculo de disponibles debe tener UNA sola definicin. Si se agrega una columna nueva (como stock_extra), actualizar TODOS los lugares que la usan, no solo la vista. Verificar siempre con un caso real antes de dar por corregido.
