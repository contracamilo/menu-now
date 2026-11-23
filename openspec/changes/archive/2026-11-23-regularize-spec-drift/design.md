# Design: regularize-spec-drift

## Context

Ver proposal.md (Why). Casi todo el cambio es documental: los deltas describen lo que el código ya hace (D-01, D-02, D-04 a D-09). Solo cuatro hallazgos tocan la SPA: D-02 (texto de error de precio), D-03, D-10 y D-11. No se toca el esquema de Supabase, ni la RLS, ni las RPC.

Estado actual relevante:
- `orderReducer` (acción `add`) añade siempre una línea nueva cuando no hay una línea sin nota del mismo plato y tamaño. `place_order` rechaza con una excepción (`22023`) un pedido con más de 50 líneas, y `OrderSummaryPage` la muestra como `order.sendError` («no se ha enviado… reintentar»), un mensaje que no ayuda.
- `table.scanToOrder` se usa en la carta general (`MenuPage`) y con un QR desconocido (`TableMenuPage`).
- `OrderDetailPage` muestra `order.receivedHelp` («Lo estamos preparando…») para «Recibido» y para «En preparación».
- `error.price` cubre tanto un formato inválido como un precio por encima de 99 999,99 € (la expresión regular de `parsePriceToCents` admite como máximo 5 cifras enteras).

## Goals / Non-Goals

**Goals:**
- Cumplir los escenarios nuevos y modificados con el menor cambio posible, cada uno con un test que lo nombre.

**Non-Goals:**
- Cambiar límites, tiempos o reglas del servidor: el límite de 50 líneas, la validación de `place_order` y el corte de las 05:00 se quedan como están.
- Refactorizar `current_service_day()`.

## Decisions

### D1. Límite de 50 líneas en el cliente, en el reductor
- Se añade `MAX_LINES = 50` en `orderReducer.ts`. La acción `add` devuelve el estado sin cambios si tendría que crear una línea nueva y el pedido ya tiene 50 líneas. Sumar a una línea existente sigue funcionando, como pide el escenario «Sumar unidades a una línea existente con 50 líneas».
- Se exporta `wouldExceedLines(lines, dishId, sizeId)`. `AddToOrder` lo consulta antes de despachar para anunciar `order.maxLines` en la región viva, en lugar de anunciar «añadido».
- Para que el aviso sea **visible**, como exige el escenario, `OrderBar` muestra el texto `order.maxLines` encima del enlace al resumen mientras el pedido tiene 50 líneas. Es un solo sitio, siempre a la vista con el pedido lleno, y no hace falta un estado de «último intento fallido».
- Alternativa descartada: dejar el límite solo en el servidor y traducir el `22023` a un mensaje específico. El comensal descubriría el límite al confirmar, con el pedido ya hecho.
- `place_order` mantiene su comprobación de 1 a 50 líneas como defensa ante un cliente manipulado.

### D2. Textos (es/en)

| Clave | es | en |
|---|---|---|
| `table.scanToOrder` (cambia) | Para pedir, escanea el código QR de tu mesa o pregunta al personal. | To order, scan the QR code on your table or ask the staff. |
| `order.receivedHelp` (cambia) | Hemos recibido tu pedido. Si necesitas algo, pregunta al personal. | We've received your order. If you need anything, please ask the staff. |
| `order.preparingHelp` (nueva) | Lo estamos preparando. Si necesitas algo, pregunta al personal. | We're preparing it. If you need anything, please ask the staff. |
| `order.maxLines` (nueva) | Has llegado al máximo de 50 líneas. Confirma este pedido y haz otro para seguir pidiendo. | You've reached the maximum of 50 lines. Confirm this order and start another to keep ordering. |
| `error.price` (cambia) | El precio debe ser mayor que cero y como máximo 99 999,99 €, con dos decimales como mucho. | The price must be greater than zero and at most €99,999.99, with no more than two decimals. |

`OrderDetailPage` elige el texto por estado: `received` muestra `order.receivedHelp`, `in_preparation` muestra `order.preparingHelp`, `cancelled` muestra `order.cancelledHelp` y `served` no muestra ninguno.

### D3. Día de servicio: test sin tocar el esquema
`current_service_day()` usa `now()` y la zona de `venue_settings.timezone`. Para probar los escenarios de las 02:00 y las 05:10 sin refactorizar la función, el test pgTAP cambia dentro de su transacción la zona del local a una zona `Etc/GMT±N`, elegida a partir de la hora UTC de `now()`, de modo que la hora local caiga entre las 02:00 y las 02:59 (el día de servicio es el anterior) o entre las 05:00 y las 05:59 (el día de servicio es el actual). Las zonas `Etc/GMT` van de −14 a +12 horas y cubren las 24 horas. La transacción termina con rollback.
- Alternativa descartada: una función `service_day_at(timestamptz)`, que obligaría a hacer una migración solo para poder testear.

### D4. Mantenimiento documental
- El «Purpose» de `backoffice-access` y de `venue-settings` se edita directamente en `openspec/specs/…` (el archivado no copia el Purpose de un delta).
- Los comentarios de cabecera de `20261120000000_pedidos_mesa.sql` y `20261121000100_panel_cocina.sql` pasan a la ruta `openspec/changes/archive/2026-11-19-…/design.md`. Supabase registra solo la versión de cada migración, no su contenido: editar un comentario no vuelve a aplicarla ni cambia la base de datos.

### D5. Tests que nombran los escenarios
Muchos escenarios nuevos ya tienen un test que comprueba ese comportamiento sin nombrarlo (contadores de 40 y 20 caracteres, reactivación con nombre repetido, Wake Lock, botón de sonido, resaltado). La convención del proyecto es nombrar el escenario en el título del test, así que esos tests se renombran o se amplían, y solo se escriben tests nuevos donde no hay cobertura.

## Risks / Trade-offs

- [Un borrador guardado con más de 50 líneas, de antes del cambio] → El reductor no recorta líneas. El servidor lo seguirá rechazando, pero es un caso prácticamente imposible (requiere 51 platos o notas distintos) y se acepta.
- [La zona `Etc/GMT` del test se ve afectada por el horario de verano] → Las zonas `Etc/GMT±N` no tienen horario de verano; el test calcula N con la hora UTC de la propia transacción.
- [Cambiar `table.scanToOrder` afecta a tests y a e2e que buscan el texto exacto] → Se actualizan en la misma tarea.

## Migration Plan

Sin migraciones nuevas ni acciones manuales por instancia: basta con desplegar el frontend. Para deshacer el cambio, basta con revertir el commit.
