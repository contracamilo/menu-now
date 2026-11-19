# Design: add-panel-cocina

## Context

- Motivación y decisiones de negocio: ver `proposal.md`. Comportamiento exigido: `specs/kitchen-panel`, los requisitos añadidos y modificados de `specs/backoffice-access` y el requisito añadido de `specs/table-ordering`.
- **Punto de partida: `add-pedidos-mesa` implementado y archivado** (ver su `design.md`). De él se usan:
  - `public.orders` (`id`, `table_id`, `service_day`, `number`, `status public.order_status`, `total_cents`, `created_at`), `public.order_items` (copia de `dish_name`, `size_label`, `unit_price_cents`, `quantity`, `note`, `position`) y `public.tables`;
  - el tipo `public.order_status` creado solo con `'received'` («panel-cocina añadirá valores»);
  - `public.current_service_day()` (día de servicio con corte a las 05:00 en `venue_settings.timezone`);
  - pedidos sin ninguna política RLS ni permiso para `anon`/`authenticated`: hoy solo se tocan con `place_order` y `get_orders`;
  - las pantallas del comensal de confirmación y «Mis pedidos» (`/t/:token/orders[/:orderId]`), que leen `status` por `get_orders` con TanStack Query (`staleTime` 30 s, `refetchOnWindowFocus`).
- Código de `add-carta-digital`: la zona privada `/admin/*` es un chunk diferido (`src/features/backoffice/AdminApp.tsx`) con `supabase-js`; `RequireOwner` + `useIsOwner` (`session.ts`) leen `backoffice_users.role`, cuyo `check` solo admite `'owner'`; `public.is_owner()` protege por RLS todas las escrituras del catálogo, del local y de las mesas. `safeNext` solo deja volver a rutas `/admin*`.
- `supabase/config.toml` tiene `[realtime] enabled = true`; ninguna tabla está publicada todavía en `supabase_realtime`.
- Una instancia por local; tablet en la barra con conexión wifi del local.

## Goals / Non-Goals

**Goals:**
- Que las transiciones de estado y la cancelación se garanticen **en el servidor**, de forma atómica y segura ante dos dispositivos que actúan a la vez sobre el mismo pedido.
- Que el panel reciba pedidos y cambios **sin recargar** y que, si pierde eventos (wifi, suspensión), **se ponga al día solo** y lo diga mientras no puede.
- Cero dependencias nuevas y cero infraestructura nueva (sin Edge Functions ni servidor propio).

**Non-Goals:**
- Tiempo real para el comensal (sigue con refresco al abrir o volver a la pantalla).
- Gestión de cuentas de personal desde la interfaz (se hacen como las de dueño, al instalar).
- Que el panel funcione sin conexión o encole acciones sin red.

## Decisions

### D1. Rutas y guardias

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/admin/kitchen` | Panel de cocina: pedidos activos del día | Personal o dueño |
| `/admin/kitchen/history` | Histórico del día: servidos y cancelados | Personal o dueño |
| resto de `/admin/*` | Administración (sin cambios) | Solo dueño |

- El panel vive **dentro de la zona `/admin`** (mismo chunk diferido, mismo `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` y `safeNext`): el personal reutiliza el inicio de sesión sin código nuevo. Alternativa descartada: una zona `/kitchen` aparte — duplicaría la guardia, el login y el `next` seguro para nada.
- `useIsOwner` se sustituye por **`useBackofficeRole(userId)`** → `'owner' | 'staff' | null` (misma consulta a `backoffice_users`, que la RLS ya limita a la fila propia).
- **`RequireOwner`**: si el rol es `'staff'`, `<Navigate to="/admin/kitchen" replace />` en lugar de cerrar la sesión (spec «El personal solo accede al panel de cocina»). Con rol `null` sigue cerrando sesión con `auth.notOwner`. Así, el personal que inicia sesión llega a `/admin` (destino por defecto de `safeNext`) y la guardia lo lleva al panel (spec «Cuentas de personal»), sin tocar `LoginPage`.
- **`RequireKitchen`** (nueva, misma forma que `RequireOwner`): admite `'owner'` y `'staff'`; sin sesión → `/admin/login?next=…`.
- `ResetPasswordPage` navega a `/admin` tras guardar la contraseña: el personal acaba en el panel por la misma redirección.
- **`KitchenLayout`** (marco propio, no `AdminLayout`): nombre del local, pestañas «Pendientes» / «Histórico de hoy», indicador de conexión (D6), botón de sonido (D7), selector de idioma, «Cerrar sesión» y, solo para el dueño, el enlace «Volver a la administración». `AdminLayout` añade el enlace «Cocina» a su navegación.
- El título de la pantalla de inicio de sesión (`auth.title`, hoy «Acceso del dueño») pasa a «Iniciar sesión», porque ahora también la usa el personal.

### D2. Migraciones

Dos archivos, porque PostgreSQL no permite usar en la misma transacción un valor recién añadido a un `enum`:

**`supabase/migrations/20261121000000_order_status_values.sql`**

```sql
alter type public.order_status add value if not exists 'in_preparation';
alter type public.order_status add value if not exists 'served';
alter type public.order_status add value if not exists 'cancelled';
```

**`supabase/migrations/20261121000100_panel_cocina.sql`**

```sql
-- Rol de personal
alter table public.backoffice_users drop constraint backoffice_users_role_check;
alter table public.backoffice_users
  add constraint backoffice_users_role_check check (role in ('owner', 'staff'));

-- Personal o dueño: quien gestiona los pedidos
create function public.can_manage_orders() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.backoffice_users
                 where user_id = auth.uid() and role in ('owner', 'staff'));
$$;

-- Momento de cada cambio de estado; coherencia estado ↔ marcas en la propia tabla
alter table public.orders
  add column preparing_at timestamptz,
  add column served_at    timestamptz,
  add column cancelled_at timestamptz,
  add constraint orders_status_times check (
    (status = 'received'       and preparing_at is null     and served_at is null     and cancelled_at is null) or
    (status = 'in_preparation' and preparing_at is not null and served_at is null     and cancelled_at is null) or
    (status = 'served'         and preparing_at is not null and served_at is not null and cancelled_at is null) or
    (status = 'cancelled'      and preparing_at is null     and served_at is null     and cancelled_at is not null)
  );

create index orders_day_created_idx on public.orders (service_day, created_at);
```

- **Marcas de tiempo por estado** en lugar de una tabla de eventos: la spec solo pide el momento de cada cambio y las transiciones son lineales, así que tres columnas bastan y el histórico se ordena por `coalesce(served_at, cancelled_at)`. Alternativa descartada: tabla `order_status_events` — más flexible para métricas, que están fuera de alcance (regla 1).
- El `check` hace imposible un estado incoherente aunque alguien escriba en la tabla con privilegios; las transiciones válidas las impone D3.
- Los pedidos existentes (todos en `'received'`) cumplen el `check` sin migrar datos.

### D3. Cambios de estado: RPC `advance_order` y `cancel_order`

```sql
-- p_from: el estado que el panel está mostrando (compare-and-set)
create function public.advance_order(p_order_id uuid, p_from public.order_status) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$ ... $$;

create function public.cancel_order(p_order_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$ ... $$;

revoke execute on function public.advance_order(uuid, public.order_status), public.cancel_order(uuid) from public;
grant  execute on function public.advance_order(uuid, public.order_status), public.cancel_order(uuid) to authenticated;
```

`advance_order`:
1. `if not public.can_manage_orders() then raise exception using errcode = '42501'`.
2. Siguiente estado fijo: `received → in_preparation`, `in_preparation → served`. Cualquier otro `p_from` (`served`, `cancelled`) → `raise … errcode '22023'` (solo un cliente manipulado lo envía; la interfaz no ofrece la acción).
3. Un único `update public.orders set status = <siguiente>, preparing_at|served_at = now() where id = p_order_id and status = p_from and service_day = public.current_service_day() returning …`.
4. Si actualiza la fila → `{"status":"ok","order":{id, number, status, preparing_at, served_at, cancelled_at}}`. Si no: si el pedido existe y es de hoy → `{"status":"conflict","current_status":…}`; si no existe o es de otro día → `{"status":"not_found"}`.

`cancel_order`: igual, con `set status = 'cancelled', cancelled_at = now() where id = p_order_id and status = 'received' and service_day = current_service_day()`; si no actualiza → `conflict` (con el estado actual) o `not_found`.

- **Compare-and-set en un solo `update`**: dos tablets que pulsan a la vez sobre el mismo pedido no pueden aplicar dos transiciones; la segunda recibe `conflict` y la interfaz lo explica (spec «Cambio de estado ya hecho desde otro dispositivo»). No hace falta bloqueo explícito.
- Saltos y retrocesos son imposibles por construcción: la función solo conoce dos transiciones y la cancelación desde `received` (spec «Ciclo de estados del pedido», «Cancelación de un pedido recibido»).
- **Solo pedidos del día de servicio actual**: coherente con «Solo los pedidos del día»; un pedido de ayer que quedó en «Recibido» no se puede tocar ni ver.
- `now()` del servidor como «momento» del cambio: no depende del reloj de la tablet.
- Mismo estilo que `place_order` (`security definer`, `search_path = ''`, respuestas con `status` para casos de negocio y excepciones para entradas imposibles). Alternativa descartada: `update` directo con RLS y un trigger que valide transiciones — la respuesta «ya había cambiado, ahora está en X» no se devuelve bien desde un `update` filtrado por RLS, y habría que abrir `update` sobre `orders` a `authenticated`.
- Los pedidos **no tienen** permisos de `insert`, `update` ni `delete` para nadie por la API: la cancelación no borra (spec), y ni siquiera es posible.

### D4. Lectura del panel: RPC `get_kitchen_orders` y RLS

```sql
-- Todos los pedidos del día de servicio actual con su mesa y sus líneas, del más antiguo al más reciente
create function public.get_kitchen_orders() returns jsonb
language sql stable security invoker set search_path = '' as $$ ... $$;
  -- {"server_now": now(), "orders": [{id, number, status, created_at, preparing_at, served_at,
  --   cancelled_at, table_name, items: [{position, dish_name, size_label, quantity, note}]}]}
  -- where service_day = public.current_service_day() order by created_at, items por position

grant execute on function public.get_kitchen_orders() to authenticated;

create policy "kitchen read orders" on public.orders
  for select to authenticated using (public.can_manage_orders());
create policy "kitchen read order items" on public.order_items
  for select to authenticated using (public.can_manage_orders());
create policy "kitchen read tables" on public.tables
  for select to authenticated using (public.can_manage_orders());
grant select on public.orders, public.order_items to authenticated;
```

- **`security invoker`**: la función lee con los permisos de quien llama, así que la RLS de arriba es la única garantía; para `anon` o una cuenta sin rol devuelve una lista vacía (spec «Acceso al panel de cocina»). Las políticas de lectura son además necesarias para que Realtime entregue eventos (D5).
- **Una RPC en lugar de un `select` con filtro `service_day=eq.<fecha>`**: el día de servicio lo decide el servidor en cada lectura, así que una tablet encendida de un día para otro pasa al día nuevo a las 05:00 sin lógica de fechas en el cliente; y devuelve mesa y líneas en una sola petición.
- `server_now` permite al cliente corregir el desfase de reloj de la tablet al calcular el tiempo transcurrido (D8).
- La política sobre `tables` deja al personal leer también el `token` de cada mesa (el secreto del QR). Se acepta: el personal está en el local delante de los QR impresos; restringirlo exigiría una vista o permisos por columna sin beneficio real.
- El personal no tiene ninguna política de escritura en `categories`, `dishes`, `dish_sizes`, `venue_settings` ni `tables`: todas exigen `is_owner()`, que sigue siendo solo `'owner'`. Nada que cambiar para cumplir «El personal solo accede al panel de cocina» en el servidor; se cubre con pruebas (D11).

### D5. Tiempo real: Supabase Realtime con `postgres_changes`

```sql
alter publication supabase_realtime add table public.orders;
```

- El panel abre **un canal** `supabase.channel('kitchen-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, …)`. Realtime aplica la RLS de `orders` a cada suscriptor: solo el personal y el dueño reciben eventos; `anon` nunca.
- **El evento es solo un aviso para releer**: ante cualquier `INSERT` o `UPDATE` se invalida `['kitchen','orders']` y TanStack Query vuelve a pedir `get_kitchen_orders()`. No se reconstruye el estado a partir de los eventos. Motivos: las líneas (`order_items`) no van en el evento, el orden y el filtro por día los resuelve el servidor y una sola fuente de verdad evita estados divergentes. Coste: una lectura pequeña por evento, irrelevante para el volumen de un bar. `order_items` no se publica: `place_order` inserta pedido y líneas en la misma transacción y el evento llega tras el `commit`, así que la relectura ya trae las líneas.
- Un `INSERT` recibido además marca ese `id` como **nuevo** (resaltado y sonido, D7). Los pedidos que ya estaban al abrir el panel no suenan.
- **Por qué Realtime y no SSE ni sondeo**: Realtime ya va dentro de `supabase-js` (dependencia existente) y está activo en cada proyecto Supabase; SSE exigiría una Edge Function de streaming propia que mantener y desplegar en cada instancia (contra la regla 1), y el sondeo corto no hace que los pedidos «aparezcan solos» al momento. Realtime usa WebSocket en lugar de SSE; para la cocina el efecto es el mismo (decisión del 2026-11-19 en `proposal.md`).
- **Red de seguridad**: `refetchInterval: 60_000` y `refetchOnWindowFocus` en la consulta del panel, porque Realtime no garantiza la entrega de eventos perdidos durante un corte. En condiciones normales el refresco llega por evento; el intervalo solo acota el peor caso.

### D6. Conexión perdida

- Estado de conexión = estado del canal (`subscribe((status) => …)`: `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`) combinado con los eventos `online`/`offline` del navegador.
- Si el canal no está `SUBSCRIBED` durante más de 5 s (para no parpadear al cargar o en reconexiones instantáneas), se muestra una banda fija arriba, con `role="alert"`: `kitchen.offline`. supabase-js reintenta la conexión solo.
- Al volver a `SUBSCRIBED` tras un corte, y en cada `visibilitychange` a visible, se invalida la consulta: el panel se pone al día con lo ocurrido mientras tanto (spec «Aviso de conexión perdida») y la banda desaparece.
- Si la relectura falla (sin red), se mantiene la última lista conocida con la banda visible; nunca se vacía la pantalla.

### D7. Aviso de pedido nuevo y pantalla encendida

- **Sonido**: dos tonos cortos (~150 ms) generados con la **Web Audio API** (`OscillatorNode`), sin archivo de audio ni dependencia. Un `INSERT` suena una vez; varios en el mismo segundo, una sola vez.
- **Política de reproducción automática**: el navegador mantiene el `AudioContext` suspendido hasta que alguien toca la página. El `KitchenLayout` muestra el botón `kitchen.enableSound` mientras el contexto esté suspendido; cualquier toque en el panel (incluido «Empezar») también lo reanuda. Una vez activo, el botón desaparece. No hay más ajustes de sonido (fuera de alcance).
- **Resaltado visual**: la tarjeta del pedido nuevo lleva la etiqueta «Nuevo» y un borde destacado durante 2 minutos o hasta que se pulsa «Empezar». Se anuncia en una región viva `aria-live="polite"`: `kitchen.newOrder` (spec «Accesibilidad del panel»).
- **Pantalla encendida**: si el navegador lo admite, el panel pide `navigator.wakeLock.request('screen')` mientras está visible y lo renueva al volver a ser visible; si no, el README indica desactivar el bloqueo automático de la tablet. Son unas líneas sin dependencia y evitan que la tablet se apague y deje de avisar.

### D8. Interfaz del panel

- **Pendientes** (`/admin/kitchen`): rejilla de tarjetas (`grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr))`), en orden de lectura del más antiguo al más reciente (spec «Pedidos activos del día»). Cada tarjeta: «Nº {number}» grande, mesa en grande, estado como **texto y color** (nunca solo color), tiempo transcurrido, líneas «{quantity} × {dish_name} · {size_label}» con la nota debajo en cursiva y con icono de nota, y las acciones:
  - «Recibido»: botón principal «Empezar» y botón secundario «Cancelar», separados para evitar toques por error;
  - «En preparación»: botón principal «Servido».
  - Botones de al menos 56 px de alto (por encima de los 44 px exigidos, por uso con prisa y de pie) con `aria-label` que incluye el número de pedido (`kitchen.startOrder`, …).
- **Tiempo transcurrido**: hook `useNow(30_000)` que repinta cada 30 s; `elapsed = (Date.now() + offset) − created_at`, con `offset = server_now − hora local al recibir la respuesta` (D4). Formato puro `formatElapsed(ms)`: `< 1 min` → `kitchen.justNow`; `< 60 min` → `{m} min`; desde una hora → `{h} h {m} min` (spec «Tiempo transcurrido de cada pedido»).
- **Acciones**: `useMutation` sobre `advance_order` / `cancel_order`; botón deshabilitado con `aria-busy` mientras se envía. `ok` → se actualiza la tarjeta en caché y se invalida la consulta. `conflict` → aviso `role="alert"` `kitchen.conflict` con el estado actual e invalidación. Error de red → `kitchen.actionError` en la tarjeta; el pedido no cambia.
- **Cancelar**: `<dialog>` nativo (`showModal`, foco atrapado, `Esc`), igual que el selector de tamaño de `add-pedidos-mesa`: `kitchen.cancelConfirm` con «Sí, cancelar» / «No, volver». No hay confirmación para «Empezar» ni para «Servido» (decisión de negocio del 2026-11-19).
- **Histórico de hoy** (`/admin/kitchen/history`): misma consulta, filtrada a `served`/`cancelled` y ordenada por `coalesce(served_at, cancelled_at)` descendente; tarjetas sin acciones, con estado y hora (`kitchen.servedAt` / `kitchen.cancelledAt`). La pestaña muestra el recuento.
- **Vacíos**: `kitchen.empty` y `history.empty` (spec «Panel sin pedidos»).
- Las pantallas usan la zona de idioma `admin` (español por defecto), tokens de color existentes y el test de contraste `contrastPairs` para los nuevos pares de estado.
- Funciones puras aparte para probarlas sin interfaz: `splitKitchenOrders(orders)` → `{ active, history }` con su orden, y `formatElapsed`.

### D9. Comensal: estados nuevos

- `OrderStatus` en el cliente pasa a `'received' | 'in_preparation' | 'served' | 'cancelled'`; la confirmación y «Mis pedidos» muestran `order.status.<status>`.
- Texto de ayuda por estado en el detalle: `received` e `in_preparation` → `order.receivedHelp` (ya existe); `cancelled` → `order.cancelledHelp`; `served` → sin texto.
- Para cumplir «actualizado cada vez que abre o vuelve», las consultas de `get_orders` pasan a `refetchOnMount: 'always'` (se mantienen `refetchOnWindowFocus` y `staleTime` 30 s). `get_orders` no cambia: ya devuelve `status`.

### D10. Textos de interfaz (es / en)

| Clave | es | en |
| --- | --- | --- |
| `auth.title` (cambia) | Iniciar sesión | Sign in |
| `admin.kitchen` | Cocina | Kitchen |
| `kitchen.title` | Pedidos | Orders |
| `kitchen.tabActive` | Pendientes ({count}) | Pending ({count}) |
| `kitchen.tabHistory` | Histórico de hoy ({count}) | Today's history ({count}) |
| `kitchen.backToAdmin` | Volver a la administración | Back to admin |
| `kitchen.orderNumber` | Nº {number} | No. {number} |
| `kitchen.table` | {table} | {table} |
| `kitchen.status.received` | Recibido | Received |
| `kitchen.status.in_preparation` | En preparación | Being prepared |
| `kitchen.status.served` | Servido | Served |
| `kitchen.status.cancelled` | Cancelado | Cancelled |
| `kitchen.new` | Nuevo | New |
| `kitchen.newOrder` | Nuevo pedido nº {number} de {table}. | New order no. {number} from {table}. |
| `kitchen.justNow` | Ahora mismo | Just now |
| `kitchen.minutes` | {m} min | {m} min |
| `kitchen.hoursMinutes` | {h} h {m} min | {h} h {m} min |
| `kitchen.elapsed` | Hace {time} | {time} ago |
| `kitchen.start` | Empezar | Start |
| `kitchen.startOrder` | Empezar el pedido nº {number} | Start order no. {number} |
| `kitchen.serve` | Servido | Served |
| `kitchen.serveOrder` | Marcar como servido el pedido nº {number} | Mark order no. {number} as served |
| `kitchen.cancel` | Cancelar | Cancel |
| `kitchen.cancelOrder` | Cancelar el pedido nº {number} | Cancel order no. {number} |
| `kitchen.cancelConfirm` | ¿Cancelar el pedido nº {number} de {table}? No se puede deshacer. | Cancel order no. {number} from {table}? This can't be undone. |
| `kitchen.cancelYes` | Sí, cancelar | Yes, cancel |
| `kitchen.cancelNo` | No, volver | No, go back |
| `kitchen.statusChanged` | Pedido nº {number}: {status}. | Order no. {number}: {status}. |
| `kitchen.conflict` | El pedido nº {number} ya había cambiado desde otro dispositivo. Ahora está: {status}. | Order no. {number} had already been changed on another device. It is now: {status}. |
| `kitchen.actionError` | No se ha podido guardar el cambio. Inténtalo de nuevo. | The change couldn't be saved. Please try again. |
| `kitchen.offline` | Sin conexión: los pedidos no se están actualizando. Reconectando… | No connection: orders are not updating. Reconnecting… |
| `kitchen.enableSound` | Activar el aviso sonoro | Turn on sound alert |
| `kitchen.empty` | No hay pedidos pendientes. Los nuevos aparecerán aquí solos. | No pending orders. New ones will show up here automatically. |
| `kitchen.servedAt` | Servido a las {time} | Served at {time} |
| `kitchen.cancelledAt` | Cancelado a las {time} | Cancelled at {time} |
| `kitchen.placedAt` | Pedido a las {time} | Ordered at {time} |
| `history.empty` | Hoy todavía no se ha servido ni cancelado ningún pedido. | No orders have been served or cancelled yet today. |
| `order.status.in_preparation` | En preparación | Being prepared |
| `order.status.served` | Servido | Served |
| `order.status.cancelled` | Cancelado | Cancelled |
| `order.cancelledHelp` | Este pedido se ha cancelado. Si tienes dudas, pregunta al personal. | This order has been cancelled. If you have any questions, please ask the staff. |

Se reutilizan `auth.signOut`, `auth.notOwner`, `common.loadError`, `menu.retry`, `lang.*` y `order.receivedHelp`. Cualquier texto nuevo durante la implementación se añade a ambos diccionarios (`en.ts` falla en compilación si falta una clave).

### D11. Estrategia de pruebas

- **pgTAP** (`supabase/tests/08_kitchen_panel.test.sql`): `backoffice_users` admite `'staff'` y rechaza otros roles; `can_manage_orders()` para dueño, personal, cuenta sin rol y `anon`; `advance_order` en sus dos transiciones con marca de tiempo; rechazo de saltos y retrocesos; `conflict` con `p_from` desfasado; `cancel_order` solo desde `received`, sin borrar y con `cancelled_at`; pedidos de otro día → `not_found`; `get_kitchen_orders` devuelve solo el día actual, en orden, para personal y dueño, y vacío para `anon` y cuentas sin rol; nadie tiene `insert`/`update`/`delete` sobre `orders`; el personal no puede escribir en `categories`, `dishes`, `dish_sizes`, `venue_settings` ni `tables`; `orders` está en la publicación `supabase_realtime`; el `check` `orders_status_times`.
- **Vitest + RTL**: `formatElapsed` y `splitKitchenOrders` (puras); `KitchenPage` (orden, contenido de tarjetas, acciones por estado, diálogo de cancelación, `conflict`, error de red, vacío); `HistoryPage`; aviso de pedido nuevo (resaltado, región viva y sonido con `AudioContext` simulado); banda de conexión con un canal falso que emite estados; relectura al recibir eventos (cubre «Los cambios de otros dispositivos aparecen solos»); `RequireOwner` redirige al personal al panel y `RequireKitchen` admite personal y dueño; estados nuevos en las pantallas del comensal. `src/test/fakeSupabase.ts` gana `channel()` con métodos para emitir eventos y estados.
- **Playwright** (`e2e/order-to-kitchen.spec.ts`, solo flujos entre roles): comensal confirma → el pedido aparece en el panel del personal sin recargar; personal empieza y sirve → el comensal ve «En preparación» y «Servido» al volver a «Mis pedidos»; personal cancela un pedido recibido → el comensal lo ve «Cancelado».

### D12. Dependencias

Ninguna nueva. Realtime va incluido en `@supabase/supabase-js`; el sonido usa Web Audio API y el diálogo `<dialog>` nativo.

## Risks / Trade-offs

- [Realtime pierde eventos durante un corte o con la tablet suspendida] → relectura completa al reconectar y al volver a ser visible, `refetchInterval` de 60 s como red de seguridad y banda de aviso mientras el canal no está activo (D5, D6).
- [El navegador bloquea el sonido hasta el primer toque] → botón visible «Activar el aviso sonoro» y reanudación con cualquier toque; el resaltado visual funciona siempre (D7). El README pide tocarlo al empezar el servicio.
- [La tablet se apaga y deja de avisar] → Wake Lock donde exista; README: desactivar el bloqueo automático y dejarla cargando.
- [Toque por error en «Servido» o «Empezar»: no se puede deshacer] → botones grandes, separados de «Cancelar» y con el número de pedido; se acepta frente a añadir confirmaciones que frenan la cocina (decisión de negocio). Si molesta en la práctica, un cambio posterior puede añadir deshacer.
- [Reloj de la tablet desajustado] → el tiempo transcurrido se corrige con `server_now`; los momentos registrados usan siempre `now()` del servidor.
- [El personal puede leer el `token` de las mesas] → aceptado (D4).
- [Cuota de conexiones Realtime del plan gratuito] → una o dos tablets por local, muy por debajo de cualquier límite.
- [Sesión de la tablet abierta durante semanas] → supabase-js renueva el token solo; si caduca, la guardia lleva al inicio de sesión con `next=/admin/kitchen`.
- [`add-pedidos-mesa` cambia antes de implementarse] → este diseño solo depende de `orders`, `order_items`, `tables`, `order_status`, `current_service_day()` y `get_orders`; si alguno cambia, revisar D2–D4 antes de aplicar.

## Migration Plan

Requiere `add-pedidos-mesa` ya desplegado en la instancia. Cambio aditivo: añade valores al tipo de estado, columnas nulas, un `check` que cumplen los pedidos existentes, funciones, políticas y la publicación de `orders`.

**Acción manual en cada instancia desplegada** (se documenta en `README.md`):
1. Aplicar las migraciones: `supabase db push`.
2. Comprobar que Realtime está activo en el proyecto (Dashboard → Project Settings → Realtime; activo por defecto).
3. **Crear cada cuenta de personal**: Dashboard → Authentication → *Add user* (correo + contraseña, *Auto confirm*) y, en el SQL Editor:
   ```sql
   insert into public.backoffice_users (user_id, role)
   select id, 'staff' from auth.users where email = '<correo del personal>';
   ```
4. Desplegar el nuevo build del frontend.
5. En la tablet: abrir `/admin/kitchen`, iniciar sesión con la cuenta de personal, tocar «Activar el aviso sonoro», desactivar el bloqueo automático de pantalla y dejarla conectada al cargador.

`supabase/seed.sql` añade una cuenta de personal de desarrollo (`staff@menu-now.test`, contraseña `menu-now-dev`) y el README la menciona junto a las de dueño.

Rollback: desplegar el build anterior (las pantallas del comensal siguen funcionando: los estados nuevos solo aparecerían si alguien los hubiera usado). La migración se puede revertir quitando funciones, políticas, columnas, la publicación y el rol mientras no haya pedidos en estados nuevos; los valores del `enum` no se pueden eliminar en PostgreSQL y se quedarían sin uso, sin efecto.

## Open Questions

- ¿Cuánto tiempo se conservan los pedidos? Sigue abierto desde `add-pedidos-mesa`: el panel solo muestra el día actual, así que la retención no afecta a este cambio.
