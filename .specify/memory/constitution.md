# Constitution — COTIZADOR 3D

## Core Principles

### I. Las tarifas son la única fuente de verdad
Todo cálculo (cotizaciones, ventas, inventario) sale de la tabla de tarifas en la base de datos, nunca de constantes escondidas en el código. Si una tarifa cambia, la próxima cotización la refleja; las históricas conservan su snapshot para no reescribir la historia. Los valores precargados provienen de los archivos de datos medidos del negocio (oct 2026).

### II. Exactitud numérica verificable
Los totales calculados deben reproducir los totales medidos del negocio (ej.: Espada Maestra 583 g / 20 h / 1.25 h MO / factura → Q314.27). Cualquier feature que toque el modelo de cobro lo verifica contra casos reales antes de implementarse. Snapshot de totales persistido con cada cotización/venta.

### III. Web estática, sin servidor propio
SPA con archivos públicos (build simple o vanilla JS), Supabase (Postgres + Auth + RLS) como único backend. La service key nunca llega al cliente: anon key + RLS estricto (una cuenta propietaria). Deploy en hosting gratuito.

### IV. Privacidad y datos privados por defecto
El negocio es de un solo propietario: sin datos públicos, RLS deny-by-default, client con copyright del email del propietario. Sin telemetría ni terceros de análisis.

### V. Paridad y retrocompatibilidad con el Excel
Mientras el Excel (.xlsm) siga vivo, la web debe permitir migrar datos (18 cotizaciones históricas, tarifas, catálogo) sin re-cálculo sorpresa, y las convenciones (folios COT-NNN/VT-NNN, estados, categorías de embalaje) deben mantenerse idénticas.

### VI. Simplicidad (YAGNI)
Un usuario, sin roles múltiples, sin pasarela de pagos, sin i18n. Cada feature debe justificarse para la operación diaria de 1 persona. Preferir decidir simple sobre flexible.
