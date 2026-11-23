# Proposal: regularize-spec-drift

## Why

La auditoría de spec drift del 2026-11-23 (veredicto «DRIFT LEVE», 14 hallazgos D-01…D-14) encontró comportamiento observable que ninguna spec describe, escenarios que el código no cumple al pie de la letra y algunos textos y documentos desalineados. La regla 3 del proyecto («la spec es la fuente de verdad») exige regularizarlo: o la spec pasa a describir el comportamiento deseado, o el código se corrige para cumplir la spec.

## Roles afectados

- **Comensal (diner)**: textos de aviso y de estado del pedido, barra del pedido, botón «Volver arriba», límite de líneas del pedido y «Mis pedidos» (D-01, D-03, D-07, D-08, D-09, D-10, D-11).
- **Dueño (owner)**: límites de los textos y precios del catálogo, de la mesa y del local; reactivación de categorías con nombre repetido (D-02, D-04).
- **Personal (staff)**: lectura de las mesas, día de servicio del panel, pantalla encendida, activación del sonido y duración del resaltado (D-01, D-05, D-06).

## What Changes

Regularización de spec (el código ya hace lo deseado):

- **D-01** Se define el **día de servicio**: la fecha local del local, que cambia a las 05:00. Es el «día» de la numeración de pedidos, de «Mis pedidos» y del panel de cocina.
- **D-02** Se especifican las longitudes máximas de los textos del catálogo, de la mesa y del local, y el precio máximo de un tamaño.
- **D-04** Se especifica que una categoría archivada no se reactiva si otra categoría activa tiene su nombre.
- **D-05** Se especifica que una sesión de personal puede leer los datos de las mesas (nombre, estado y QR) sin acceder a la pantalla «Mesas» ni modificarlas.
- **D-06** Se especifican la pantalla siempre encendida del panel, la acción para activar el aviso sonoro y la duración del resaltado de un pedido nuevo.
- **D-07** «Mis pedidos» muestra número, hora, total y estado; las líneas se ven al abrir cada pedido.
- **D-08** La barra del pedido (unidades, total y acceso al resumen) se muestra mientras el pedido tiene al menos una línea.
- **D-09** El botón «Volver arriba» aparece cuando el comensal ha bajado más de una pantalla.

Regularización con cambio de código:

- **D-03** Un pedido admite como máximo 50 líneas. Hoy el servidor rechaza la línea 51 y el comensal ve un falso «no se ha enviado». La carta impedirá añadir una línea 51 y avisará del límite.
- **D-02 (texto)** El mensaje de precio no válido menciona el máximo de 99 999,99 €. Hoy, con un precio de 100 000 €, dice solo «mayor que cero, con como máximo dos decimales».
- **D-10** El aviso de «no se puede pedir» de la dirección general y de un QR desconocido añade «o pregunta al personal», como ya exige la spec.
- **D-11** En la confirmación, un pedido «Recibido» deja de decir «Lo estamos preparando»; ese texto queda para «En preparación».

Mantenimiento (sin cambio de comportamiento):

- **D-12** Se actualiza el «Purpose» de `backoffice-access` y `venue-settings`, que aún habla de «este cambio».
- **D-13** Los comentarios de las migraciones apuntan a las rutas archivadas de los design.
- **D-14** Se añade un test que nombra el escenario «El comensal pide a pleno sol».

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `table-ordering`: se añaden «Día de servicio» y «Máximo de líneas por pedido». Se modifican «Número y estado del pedido», «Pedidos hechos desde el móvil» y «Añadir platos al pedido».
- `kitchen-panel`: se modifica «Solo los pedidos del día» para que use el día de servicio. Se añaden la pantalla siempre encendida, la activación del aviso sonoro y la duración del resaltado de un pedido nuevo.
- `catalog-management`: se añaden las longitudes máximas de textos, el precio máximo y la reactivación de una categoría con nombre repetido.
- `table-management`: se añade la longitud máxima del nombre de una mesa.
- `venue-settings`: se añade la longitud máxima del nombre del local.
- `backoffice-access`: se modifica «El personal solo accede al panel de cocina» para incluir la lectura de las mesas.
- `menu`: se modifica «Volver al inicio de la carta» para concretar cuándo aparece el botón.

## Decisiones de negocio

| Fecha | Decisión |
| --- | --- |
| 2026-11-23 | El «día» de pedidos, «Mis pedidos» y panel es el **día de servicio**, que cambia a las **05:00** hora local del local (ya implementado en `add-pedidos-mesa`). Un pedido de madrugada sigue la numeración de la noche anterior. |
| 2026-11-23 | Se mantienen los límites actuales: categoría 40 caracteres, plato 80, descripción 160, «con qué compra se incluye» 60, tamaño 20, mesa 20, local 60; precio máximo 99 999,99 €. |
| 2026-11-23 | **El personal puede leer las mesas** (nombre, estado y QR) por el sistema; se acepta porque el QR no da más poder que el que ya tiene el comensal que lo escanea. Sigue sin acceder a la pantalla «Mesas» y sin poder modificarlas (decisión del usuario sobre D-05). |
| 2026-11-23 | La lista de «Mis pedidos» muestra número, hora, total y estado; **las líneas se ven en el detalle** del pedido (decisión del usuario sobre D-07). |
| 2026-11-23 | Un pedido admite **como máximo 50 líneas**; al llegar al límite la carta lo avisa y no añade más. |
| 2026-11-23 | La barra del pedido no se muestra con el pedido vacío; el botón «Volver arriba» aparece tras bajar más de una pantalla. |
| 2026-11-23 | El panel pide mantener la pantalla encendida donde el navegador lo admite, ofrece «Activar el aviso sonoro» mientras el navegador bloquea el sonido y resalta un pedido nuevo durante 2 minutos o hasta pulsar «Empezar». |

## Fuera de alcance

- Cambiar cualquiera de los límites o comportamientos que aquí se especifican tal cual están.
- Restringir la lectura de mesas del personal (descartado en D-05).
- Las revisiones manuales con VoiceOver/TalkBack, que se hacen al final del proyecto.

## Impact

- **Specs**: deltas en 7 capacidades; «Purpose» de `backoffice-access` y `venue-settings`.
- **SPA**: `src/features/order/orderReducer.ts`, `AddToOrder.tsx` (límite de 50 líneas); `src/i18n/es.ts` y `en.ts` (textos de D-03, D-10, D-11); `OrderDetailPage.tsx` (D-11); tests asociados.
- **Supabase**: sin cambios de esquema ni de RLS; solo comentarios de dos migraciones ya aplicadas (sin efecto en la base de datos).
- **Acción manual por instancia**: ninguna.
- **Dependencias**: ninguna nueva.
