# Proposal: add-panel-cocina

## Why

Con `add-pedidos-mesa` el comensal ya puede pedir desde su móvil, pero los pedidos confirmados se quedan en la base de datos con el estado «Recibido» sin que nadie los vea: no hay pantalla de personal. Hace falta la pantalla con la que cocina y barra reciben los pedidos al momento, en una tablet apoyada en la barra, y los marcan según avanzan, para que no se pierda ninguno y el comensal sepa en qué punto está el suyo.

## Roles afectados

- **Personal (staff)**: nuevo rol con cuenta propia. Inicia sesión en la tablet con la misma pantalla de inicio de sesión de la administración y solo accede al panel de cocina: ve los pedidos del día en tiempo real, los pasa a «En preparación» y a «Servido», cancela los que aún están en «Recibido» y consulta el histórico del día.
- **Dueño (owner)**: puede abrir también el panel de cocina desde la administración, con los mismos permisos que el personal sobre los pedidos. Sus cuentas y su acceso a la administración no cambian.
- **Comensal (diner)**: en la confirmación y en «Mis pedidos» ve el estado actual de cada pedido («Recibido», «En preparación», «Servido» o «Cancelado») cuando abre o vuelve a esas pantallas. No recibe avisos en tiempo real.

## What Changes

- Nuevas **cuentas de personal**, dadas de alta al instalar el local (como las de dueño). Usan el mismo inicio de sesión, cierre de sesión y restablecimiento de contraseña; tras iniciar sesión llegan al panel de cocina y no pueden ver ni usar ninguna otra pantalla de la administración.
- Nuevo **panel de cocina** (pantalla de personal, pensada para tablet):
  - pedidos activos del día («Recibido» y «En preparación»), del más antiguo al más reciente, con número de pedido, mesa, platos con tamaño y cantidad, notas del comensal, estado y tiempo transcurrido desde la confirmación;
  - los pedidos nuevos aparecen solos, sin recargar, con un aviso visual y un sonido breve;
  - acciones «Empezar» (Recibido → En preparación) y «Servido» (En preparación → Servido);
  - «Cancelar» solo en pedidos «Recibido», con confirmación previa; registra el momento y no borra el pedido;
  - aviso visible cuando el panel pierde la conexión y deja de recibir pedidos;
  - **histórico del día** con los pedidos servidos y cancelados.
- Nuevos **estados del pedido**: «En preparación», «Servido» y «Cancelado», con transiciones estrictas en el servidor.
- El comensal ve el **estado actualizado** de sus pedidos en la confirmación y en «Mis pedidos».

## Capabilities

### New Capabilities

- `kitchen-panel`: el panel con el que el personal recibe y gestiona los pedidos del día — lista de pedidos activos en tiempo real, aviso de pedido nuevo, ciclo de estados del pedido, cancelación, histórico del día y quién puede usarlo.

### Modified Capabilities

- `backoffice-access`: se añaden las cuentas de personal (acceso solo al panel de cocina) y el requisito «Sin registro público de cuentas» pasa a cubrir también las cuentas de personal.
- `table-ordering` (capacidad que introduce `add-pedidos-mesa`, todavía sin archivar): se añade que el comensal ve el estado actual de sus pedidos, con los estados nuevos.

## Decisiones de negocio

| Fecha | Decisión |
| --- | --- |
| 2026-11-19 | El panel de cocina exige **sesión iniciada** con el mismo mecanismo de inicio de sesión que la administración. |
| 2026-11-19 | El panel se usa con **cuentas de personal** nuevas (una o varias por local, dadas de alta al instalar, sin registro público). Una cuenta de personal **solo accede al panel**, nunca a la carta, al local ni a las mesas de la administración. El **dueño** también puede usar el panel. |
| 2026-11-19 | Todo pedido confirmado entra en **«Recibido»**. La cocina lo pasa a **«En preparación»** al empezar a prepararlo y a **«Servido»** cuando sale a la mesa. Las únicas transiciones válidas son Recibido → En preparación → Servido: **sin saltos ni retrocesos**. |
| 2026-11-19 | Un pedido **solo se puede cancelar en «Recibido»**. Si ya está en preparación, no se cancela desde la aplicación: se resuelve hablando. La cancelación **registra el momento** y **no borra** el pedido. Cancelado es un estado final. |
| 2026-11-19 | Como un cambio de estado no se puede deshacer, **cancelar pide confirmación**; empezar y servir son un solo toque (botones grandes y rotulados), para no frenar a la cocina en hora punta. |
| 2026-11-19 | El panel muestra los **pedidos del día** (el mismo día de servicio que reinicia la numeración en `add-pedidos-mesa`), del **más antiguo al más reciente**, con mesa, platos, cantidades, notas del comensal y tiempo transcurrido. |
| 2026-11-19 | El panel se **actualiza en tiempo real** sin recargar: los pedidos nuevos y los cambios de estado hechos desde otro dispositivo aparecen solos. Mecanismo: **Supabase Realtime** (incluido en Supabase, sin infraestructura nueva), en lugar de un endpoint SSE propio, por la regla 1. |
| 2026-11-19 | Un pedido nuevo se anuncia con un **aviso simple**: resaltado visual y un sonido breve. No hay sonidos configurables. |
| 2026-11-19 | Los pedidos **servidos y cancelados** salen de la vista activa y se consultan en el **histórico del día**, del más reciente al más antiguo, con la hora en que se sirvieron o cancelaron. |
| 2026-11-19 | El comensal ve en la confirmación y en «Mis pedidos» el **estado actual** de cada pedido cuando abre o vuelve a esas pantallas. Los avisos en tiempo real al comensal siguen fuera de alcance. |

## Fuera de alcance

- Métricas y estadísticas (tiempos medios, platos más pedidos, etc.).
- Impresión de tickets o comandas.
- Gestión de turnos o de empleados; alta de cuentas de personal desde la interfaz (se hace al instalar, como las de dueño).
- Notificaciones sonoras configurables (volumen, tonos, silencio por franjas).
- Modificar las líneas de un pedido confirmado; deshacer un cambio de estado.
- Histórico de días anteriores en la interfaz.
- Avisos en tiempo real al comensal.
- Estados por plato (el estado es del pedido completo).

## Impact

- **Depende de `add-pedidos-mesa`**, que debe implementarse y archivarse antes (aporta mesas, pedidos, líneas, día de servicio y el estado «Recibido»).
- **Supabase**: nueva migración que añade el rol `staff`, los estados nuevos del pedido con sus marcas de tiempo, funciones para cambiar el estado y cancelar con las transiciones validadas en el servidor, políticas RLS de lectura de pedidos para personal y dueño, y publicación de los pedidos en Realtime.
- **SPA**: nueva pantalla del panel de cocina e histórico dentro de la zona privada; la guardia de sesión distingue dueño y personal; enlace al panel en la navegación del dueño; estados nuevos en las pantallas del comensal.
- **Acción manual por instancia**: aplicar la migración, dar de alta las cuentas de personal y dejar la tablet con la sesión iniciada en el panel.
- **Dependencias**: ninguna nueva (Realtime ya va en `supabase-js`).
