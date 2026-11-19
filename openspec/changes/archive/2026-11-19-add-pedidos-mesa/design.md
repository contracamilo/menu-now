# Design: add-pedidos-mesa

## Context

- Motivación y decisiones de negocio: ver `proposal.md`. Comportamiento exigido: `specs/table-management`, `specs/table-ordering` y el requisito modificado de `specs/menu`.
- Punto de partida (código de `add-carta-digital`, ver `openspec/changes/archive/2026-11-19-add-carta-digital/design.md`):
  - La carta (`/`, `src/features/menu/`) lee con `fetch` directo a PostgREST (`src/lib/rest.ts`), sin `supabase-js`, y un plugin de Vite (`vite.config.ts`) lanza desde `index.html` las consultas de `src/lib/publicQueries.ts` **solo cuando `location.pathname === '/'`**. Presupuesto: LCP < 2 s y JS inicial ≤ 150 KB gzip (`lighthouserc.json`, solo mide `/`).
  - La administración (`/admin/*`, chunk diferido) usa `supabase-js`; la guardia `RequireOwner` y la RLS con `public.is_owner()` protegen las escrituras.
  - Las reglas críticas viven en la base de datos (constraint triggers, RLS, RPC `security invoker`); los platos y categorías no se borran, se archivan (`archived_at`). `save_dish` **actualiza en sitio** los tamaños que conservan su `id` y **borra** los que ya no vienen.
  - Precios en céntimos enteros; `formatPrice`/`priceLines` en `src/lib/money.ts`; i18n propio con `es.ts` como fuente de claves y `en.ts` con `satisfies Messages`.
  - Tests: pgTAP en `supabase/tests/01…04` (el `04_ordering_and_save` es del **orden** del catálogo, no de pedidos), Vitest+RTL con `src/test/fakeSupabase.ts`, un e2e Playwright (`e2e/catalog-to-menu.spec.ts`), LHCI.
- Una instancia por local, sin columna de local en ninguna tabla.

## Goals / Non-Goals

**Goals:**
- Que las reglas del pedido que protegen al local y al comensal (mesa activa, plato visible y con precio, tamaño del plato, precio igual al visto, límites de cantidad y nota, numeración, un solo pedido por confirmación) se garanticen **en el servidor**, en una única función atómica.
- Que el comensal anónimo no pueda leer ni modificar pedidos ajenos ni enumerar mesas.
- Mantener el presupuesto de rendimiento de la carta también cuando se abre desde el QR de una mesa.

**Non-Goals:**
- Tiempo real (Supabase Realtime) y cambios de estado: llegarán con `panel-cocina`. Aquí el estado solo puede ser «Recibido».
- Pantallas o permisos de personal (`staff`): `panel-cocina` añadirá el rol y sus políticas de lectura.
- Limitar abusos por IP o captcha (ver Risks).

## Decisions

### D1. Rutas

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/` | Carta en modo consulta (sin mesa) + aviso «para pedir, escanea el QR de tu mesa» | Público |
| `/t/:token` | Carta de la mesa: nombre de la mesa, botones «Añadir», barra del pedido | Público |
| `/t/:token/order` | Resumen del pedido sin confirmar y confirmación | Público |
| `/t/:token/orders` | «Mis pedidos» (los confirmados desde este móvil hoy) | Público |
| `/t/:token/orders/:orderId` | Confirmación / detalle de un pedido: número, mesa, líneas, total, estado | Público |
| `/admin/tables` | «Mesas»: activas (por nombre) y archivadas | Dueño |
| `/admin/tables/new`, `/admin/tables/:id` | Formulario de mesa (nombre) | Dueño |
| `/admin/tables/:id/qr` | QR imprimible de la mesa | Dueño |

- `token` es un UUID aleatorio propio de cada mesa (D2), no su `id`. Un `token` con formato no válido, inexistente o de una mesa archivada muestra la carta en modo consulta con el aviso correspondiente (spec «Pedir solo desde la carta de una mesa activa»); no es un 404, porque el comensal tiene un QR físico delante y lo útil es ver la carta.
- Las tres subrutas de `/t/:token` se cargan con `React.lazy` (chunk aparte) para no engordar el JS inicial de la carta; el botón «Añadir», el selector de tamaño y la barra del pedido van en el chunk de la carta porque se usan desde ella (≈ 3–4 KB gzip estimados).
- La pantalla «Mesas» se añade a la navegación de `AdminLayout` junto a «Mi carta» y «Mi local».

### D2. Modelo de datos (migración `supabase/migrations/20261120000000_pedidos_mesa.sql`)

```sql
-- Día de servicio: fecha local del local, que cambia a las 05:00 (un bar abierto hasta la 1:30
-- no reinicia la numeración a mitad del servicio). Zona horaria por instancia.
alter table public.venue_settings
  add column timezone text not null default 'Europe/Madrid'
  check ((timestamptz '2000-01-01 00:00+00' at time zone timezone) is not null);  -- una zona inexistente lanza error

create function public.current_service_day() returns date
language sql stable security definer set search_path = '' as $$
  select ((now() at time zone v.timezone) - interval '5 hours')::date
    from public.venue_settings v;
$$;

create table public.tables (
  id          uuid primary key default gen_random_uuid(),
  token       uuid not null unique default gen_random_uuid(),  -- lo que va en el QR
  name        text not null check (char_length(btrim(name)) between 1 and 20),
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create unique index tables_active_name_unique on public.tables (lower(btrim(name)))
  where archived_at is null;

create type public.order_status as enum ('received');  -- panel-cocina añadirá valores

create table public.orders (
  id          uuid primary key,                -- lo genera el cliente: idempotencia (D3)
  table_id    uuid not null references public.tables(id) on delete restrict,
  service_day date not null,
  number      integer not null check (number > 0),
  status      public.order_status not null default 'received',
  total_cents integer not null check (total_cents > 0),
  created_at  timestamptz not null default now(),
  constraint orders_number_per_day unique (service_day, number)
);
create index orders_table_day_idx on public.orders (table_id, service_day);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  position         integer not null,
  dish_id          uuid not null references public.dishes(id) on delete restrict,
  size_id          uuid references public.dish_sizes(id) on delete set null,
  dish_name        text not null,             -- copia al confirmar
  size_label       text,                      -- copia al confirmar (null = tamaño sin nombre)
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity         integer not null check (quantity between 1 and 20),
  note             text check (note is null or char_length(note) between 1 and 140),
  constraint order_items_position_unique unique (order_id, position)
);

-- Contador por día de servicio: una fila por día, incrementada con bloqueo de fila
create table public.order_counters (
  service_day date primary key,
  last_number integer not null
);
```

- **Copia de nombre, tamaño y precio en `order_items`** (resuelve la entrega pendiente de `add-carta-digital` D4): `save_dish` edita los tamaños en sitio y borra los quitados, así que una referencia viva cambiaría el pedido. Las FK se mantienen para trazabilidad y para `panel-cocina`: `dish_id` es seguro (los platos no se borran) y `size_id` pasa a `null` si el dueño quita el tamaño. Alternativa descartada: archivar tamaños en lugar de borrarlos — obliga a modificar `save_dish`, la carta y la administración para nada que el comensal vea.
- **`token` separado del `id`**: el `id` puede aparecer en pantallas del dueño y, más adelante, del personal; el `token` es el secreto del QR. Separarlos cuesta una columna y deja abierta la regeneración del QR sin tocar FK (Open Questions). UUID aleatorio (122 bits): imposible de adivinar, QR pequeño (URL de ~60 caracteres).
- **Numeración**: `insert into order_counters … on conflict (service_day) do update set last_number = last_number + 1 returning last_number` dentro de `place_order`: atómico y sin huecos por concurrencia (el bloqueo de fila serializa solo la asignación del número). Alternativa descartada: `sequence` global — no reinicia por día y los números crecen a cuatro cifras.
- **Día de servicio con corte a las 05:00** y zona horaria en `venue_settings.timezone` (por defecto `Europe/Madrid`; no editable desde la interfaz). Cumple «correlativos dentro de cada día» sin reiniciar a medianoche en mitad del servicio.
- **Total guardado** (`total_cents`): lo calcula `place_order` a partir de las líneas copiadas; evita recalcular en cada lectura y es lo que el comensal confirmó.
- Límites: nombre de mesa 20 caracteres (cabe en la cabecera de la carta y en la tarjeta del QR), nota 140 (decisión de negocio), cantidad 1–20 (decisión de negocio), máximo 50 líneas por pedido (técnico, en `place_order`; ningún pedido real de una mesa lo alcanza).

### D3. Confirmar el pedido: RPC `place_order` (anónima, atómica, idempotente)

```sql
-- p_items: [{dish_id, size_id, quantity, note?, unit_price_cents}]  (precio = el que vio el comensal)
create function public.place_order(p_order_id uuid, p_table_token uuid, p_items jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$ ... $$;

revoke execute on function public.place_order(uuid, uuid, jsonb) from public;
grant  execute on function public.place_order(uuid, uuid, jsonb) to anon, authenticated;
```

Pasos, en una transacción:
1. **Idempotencia**: si ya existe `orders.id = p_order_id`, devuelve ese pedido (`{"status":"placed", "order":…}`) si pertenece a la mesa del token; si no, error `22023`. Así, dos pulsaciones seguidas o un reintento tras perder la respuesta no crean dos pedidos (spec «Confirmación sin datos personales»).
2. **Mesa**: busca `tables` por `token` con `archived_at is null`. Si no existe → `{"status":"table_unavailable"}`.
3. **Forma**: 1–50 líneas; `quantity` 1–20; `note` recortada (vacía → `null`) de ≤ 140 caracteres; `dish_id`, `size_id` y `unit_price_cents` presentes. Si no → `raise … errcode '22023'` (solo ocurre con un cliente manipulado; la interfaz lo impide antes).
4. **Disponibilidad y precio**, por línea, contra el estado actual: el plato existe con `archived_at is null`, su categoría `archived_at is null` y `not is_included`, y el tamaño existe y pertenece a ese plato. Si falla → la línea va a `unavailable` (con `dish_id` y nombre actual o el que envió el cliente). Si el precio actual del tamaño ≠ `unit_price_cents` → va a `price_changes` (`size_id`, precio nuevo).
5. Si hay `unavailable` o `price_changes` → `{"status":"rejected","unavailable":[…],"price_changes":[…]}` **sin insertar nada**. El cliente retira las líneas no disponibles, actualiza los precios, muestra los avisos y el resumen nuevo, y el comensal vuelve a confirmar (puede ser con el mismo `p_order_id`, porque nada se insertó).
6. Si todo es válido → número del día (D2), inserta `orders` y `order_items` con la copia de nombre, tamaño y precio, y devuelve `{"status":"placed","order":{id, number, status, table_name, total_cents, created_at, items:[…]}}`.

- `security definer` con `search_path = ''`: el comensal anónimo no tiene ningún permiso directo sobre `tables`, `orders` ni `order_items`; la función es la única puerta y valida todo. Alternativa descartada: `insert` directo con RLS para `anon` — habría que repartir las validaciones entre políticas, triggers y una secuencia, y la respuesta «estos platos ya no están» no se puede devolver desde un `insert` fallido.
- Respuestas con `status` en lugar de excepciones para los casos de negocio (rechazo, mesa no disponible): el cliente los distingue sin parsear mensajes de error; las excepciones quedan para entradas imposibles desde la interfaz.
- El precio que el comensal vio viaja en la petición **solo para compararlo**; el precio guardado es siempre el de la base de datos.

### D4. Lecturas públicas de la mesa y de «Mis pedidos»

```sql
-- Nombre y estado de la mesa del QR (null si el token no existe)
create function public.get_table(p_token uuid)
returns table (name text, active boolean)
language sql stable security definer set search_path = '' as $$
  select t.name, t.archived_at is null from public.tables t where t.token = p_token;
$$;

-- Pedidos de hoy de esa mesa cuyos id conoce el móvil
create function public.get_orders(p_table_token uuid, p_order_ids uuid[])
returns jsonb
language sql stable security definer set search_path = '' as $$ ... $$;
  -- orders ⋈ tables (token = p_table_token) donde id = any(p_order_ids)
  -- y service_day = public.current_service_day(); con sus items por position

grant execute on function public.get_table(uuid), public.get_orders(uuid, uuid[]) to anon, authenticated;
```

- **«Mis pedidos» = los `id` guardados en ese móvil.** Tras cada pedido registrado, el cliente añade su `id` a `localStorage['menu-now.orders.<token>']`. `get_orders` solo devuelve los pedidos cuyo `id` conoce quien pregunta, de esa mesa y del día de servicio actual: un UUID aleatorio funciona como prueba de que el pedido se hizo desde ese móvil, sin cuentas ni datos personales (regla 2). Los `id` que el servidor ya no devuelve (días anteriores) se eliminan del almacenamiento. Si `localStorage` no está disponible, «Mis pedidos» solo muestra lo confirmado en la pestaña actual (estado en memoria).
- Alternativa descartada: política RLS de lectura de `orders` para `anon` filtrada por mesa — dejaría a cualquiera con el QR (o una foto de él) leer todos los pedidos de la mesa, contra «no ve los pedidos de otro móvil».
- Ambas funciones son `stable`, así que PostgREST las sirve por `GET /rest/v1/rpc/get_table?p_token=…` y se pueden lanzar como peticiones tempranas (D6).
- La lista de «Mis pedidos» y el detalle se refrescan con TanStack Query (`staleTime` 30 s, `refetchOnWindowFocus`), suficiente mientras el estado no cambie; `panel-cocina` decidirá si hace falta tiempo real.

### D5. RLS y permisos

```sql
alter table public.tables         enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_counters enable row level security;

-- Mesas: solo el dueño lee y escribe; sin borrado
create policy "owner read tables" on public.tables
  for select to authenticated using (public.is_owner());
create policy "owner insert tables" on public.tables
  for insert to authenticated with check (public.is_owner());
create policy "owner update tables" on public.tables
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- El token no se puede cambiar desde la API (renombrar no cambia el QR)
revoke update on public.tables from authenticated;
grant  update (name, archived_at) on public.tables to authenticated;

revoke all on public.tables from anon;
revoke delete, truncate on public.tables from authenticated;

-- Pedidos: sin políticas → nadie los lee ni escribe por la API; solo place_order/get_orders
revoke all on public.orders, public.order_items, public.order_counters from anon, authenticated;
```

- `anon` no puede listar mesas: solo resolver un token concreto con `get_table`.
- El dueño tampoco lee pedidos en este cambio (no hay pantalla que los use); `panel-cocina` añadirá las políticas de lectura y cambio de estado para el personal.
- Archivar/reactivar una mesa es un `update` de `archived_at`; reactivar con un nombre ya usado por una mesa activa falla por `tables_active_name_unique` (`23505`) y la interfaz muestra `error.tableNameTaken`.

### D6. Carta por mesa: rendimiento y peticiones tempranas

- `publicQueries.ts` pasa a describir las peticiones tempranas por ruta: en `/` las dos actuales; en `/t/<token>` además `rpc/get_table?p_token=<token>` (el script inline extrae el token de `location.pathname` con una expresión regular de UUID y no pide nada si no casa). Se mantiene la regla de definir cada consulta una sola vez.
- `main.tsx` prefetch: carta y local en `/` y en `/t/*`; mesa solo en `/t/*`.
- `lighthouserc.json` añade la URL `/t/<token de la mesa de referencia>` (mesa sembrada en `supabase/seed.sql` con token fijo) con las mismas aserciones (LCP < 2 000 ms, JS ≤ 150 KB gzip, accesibilidad = 1).
- La cabecera muestra el nombre de la mesa («Mesa 4») bajo el nombre del local, con hueco reservado desde el primer pintado para no provocar CLS al llegar `get_table`.

### D7. Pedido sin confirmar en el móvil

- Estado en un `OrderProvider` (contexto de React) montado en `/t/:token/*`, con `useReducer` y acciones `add`, `setQuantity`, `setNote`, `remove`, `applyRejection`, `clear`. Sin librería de estado.
- Línea: `{ key, dish_id, size_id, dish_name, size_label, unit_price_cents, quantity, note }`. `add` busca una línea con el mismo `dish_id` + `size_id` y **sin nota**: si existe, suma 1 (tope 20); si no, crea una línea nueva (spec «Líneas, cantidades y notas del pedido»). Escribir una nota en una línea la convierte en línea con nota; añadir otra vez el mismo plato crea entonces otra línea sin nota.
- Persistencia: `localStorage['menu-now.draft.<token>'] = { orderId, lines }`, leída al montar y escrita en cada cambio, con try/catch (como el idioma, D8 de `add-carta-digital`). No contiene ningún dato personal.
- **`orderId` para la idempotencia**: se genera con `crypto.randomUUID()` la primera vez que se confirma y se conserva hasta que el pedido se registra; cualquier cambio en las líneas genera uno nuevo. Tras `placed`, se borra el borrador y se navega a `/t/:token/orders/:orderId`.
- El precio que se muestra y se envía es el de la línea (el que el comensal vio al añadir). Si la carta se recarga con un precio distinto, el pedido no se corrige solo: la comprobación ocurre al confirmar (D3), que es lo que exige la spec y evita cambios silenciosos.
- Notas: `<textarea maxLength={140}>` con contador `form.charCount` («37/140»); al enviar se recorta y una nota vacía se envía como `null`.

### D8. Interfaz del comensal

- **Botón «Añadir»** en cada `DishCard` con tamaños (nunca en «Incluidos»), solo en `/t/:token` con mesa activa: botón de 44 px con texto visible «Añadir» y `aria-label` «Añadir {plato}». Con un tamaño, añade directamente; con varios, abre un **selector de tamaño** en un `<dialog>` nativo (`showModal`, foco atrapado y `Esc` del navegador, sin librería) con un botón por tamaño («Ración · 7,00 €») y «Cancelar».
- **Barra del pedido** fija abajo, visible cuando hay líneas: «Ver pedido · {count} · {total}». El botón «Volver arriba» se desplaza por encima de la barra cuando esta existe.
- **Región viva** (`role="status"`, `aria-live="polite"`) que anuncia «{plato} añadido. Total: {total}» y los cambios de cantidad o retiradas (spec «Accesibilidad del pedido»).
- **Resumen** (`/t/:token/order`): mesa; lista de líneas con nombre (+ tamaño si tiene nombre), controles − / cantidad / + (`aria-label` «Quitar una unidad de {plato}» / «Añadir una unidad de {plato}»; − deshabilitado en 1, + en 20), nota editable, importe de la línea y «Quitar {plato}»; total con «IVA incluido»; botones «Seguir pidiendo» y «Confirmar pedido» (deshabilitado y con `aria-busy` mientras se envía; ausente si el pedido está vacío, con el mensaje `order.empty`).
- **Rechazo** (`rejected`): se aplican los cambios al borrador y se muestra arriba del resumen un aviso `role="alert"` con la lista de platos retirados (`order.unavailable`) y de precios cambiados (`order.priceChanged`); si el pedido queda vacío, `order.allUnavailable`.
- **Mesa no disponible** (`table_unavailable`, o `get_table` con `active = false`): aviso `order.tableUnavailable`, sin botones de añadir ni de confirmar; el borrador se conserva por si el dueño reactiva la mesa.
- **Error de red** al confirmar: `order.sendError` + «Reintentar» (mismo `orderId`); el borrador no se toca.
- **Confirmación** (`/t/:token/orders/:orderId`): número grande («Pedido nº 3»), mesa, líneas, total, estado «Recibido» y el texto «Lo estamos preparando. Si necesitas algo, pregunta al personal.» como ayuda; botones «Volver a la carta» y «Mis pedidos».
- **Mis pedidos** (`/t/:token/orders`): lista de tarjetas (número, hora, total, estado) que abren el detalle; vacío → `orders.empty`.
- Formato de importes con `formatPrice` (D8 de `add-carta-digital`); los totales se calculan en céntimos enteros.

### D9. Administración de mesas y QR

- `src/features/tables/`: `TablesPage` (activas ordenadas por nombre con `localeCompare` de la interfaz, archivadas en sección aparte; acciones Editar, Ver QR, Archivar/Reactivar), `TableForm` (nombre, contador 20, errores `error.required`, `error.tableNameTaken`), `TableQrPage`, `useTables` (supabase-js, invalidación como `useCatalog`).
- **QR**: se genera en el navegador como SVG a partir de `${window.location.origin}/t/${token}` con nivel de corrección M. `TableQrPage` muestra una tarjeta imprimible (nombre del local, nombre de la mesa en grande, QR de ~6 cm, texto bilingüe fijo «Escanea para ver la carta y pedir · Scan to see the menu and order», porque la tarjeta impresa la leen comensales de ambos idiomas); botones «Imprimir» (`window.print()` con `@media print` que oculta la navegación) y «Descargar» (archivo `qr-<nombre-de-mesa>.svg` generado con un `Blob`).
- Si el dueño abre la administración desde una URL que no es la pública (p. ej. `localhost` en desarrollo), la tarjeta muestra la URL codificada bajo el QR para que se vea a dónde apunta.

### D10. Textos de interfaz (es / en)

| Clave | es | en |
| --- | --- | --- |
| `table.label` | Mesa: {name} | Table: {name} |
| `table.scanToOrder` | Para pedir, escanea el código QR de tu mesa. | To order, scan the QR code on your table. |
| `table.unavailable` | Desde esta mesa no se pueden hacer pedidos. Pregunta al personal. | Orders can't be placed from this table. Please ask the staff. |
| `order.add` | Añadir | Add |
| `order.addDish` | Añadir {dish} | Add {dish} |
| `order.chooseSize` | Elige el tamaño de {dish} | Choose a size for {dish} |
| `order.added` | {dish} añadido. Total: {total} | {dish} added. Total: {total} |
| `order.bar` | Ver pedido · {count} · {total} | View order · {count} · {total} |
| `order.title` | Tu pedido | Your order |
| `order.forTable` | Pedido para {table} | Order for {table} |
| `order.empty` | Tu pedido está vacío. Añade platos desde la carta. | Your order is empty. Add dishes from the menu. |
| `order.decrease` / `order.increase` | Quitar una unidad de {dish} / Añadir una unidad de {dish} | Remove one {dish} / Add one more {dish} |
| `order.quantity` | Cantidad de {dish} | Quantity of {dish} |
| `order.remove` | Quitar {dish} | Remove {dish} |
| `order.removed` | {dish} quitado del pedido. | {dish} removed from your order. |
| `order.note` | Nota (opcional) | Note (optional) |
| `order.noteHint` | Por ejemplo: «sin cebolla», «poco hecho». | For example: "no onion", "rare". |
| `order.total` | Total (IVA incluido) | Total (VAT included) |
| `order.keepOrdering` | Seguir pidiendo | Keep ordering |
| `order.confirm` | Confirmar pedido | Confirm order |
| `order.sending` | Enviando el pedido… | Sending your order… |
| `order.sendError` | No hemos podido enviar el pedido. Tu pedido sigue aquí. | We couldn't send your order. Your order is still here. |
| `order.retry` | Reintentar | Try again |
| `order.unavailable` | Ya no están disponibles y los hemos quitado de tu pedido: {dishes}. Revisa tu pedido y confírmalo de nuevo. | These are no longer available and have been removed from your order: {dishes}. Please check your order and confirm again. |
| `order.allUnavailable` | Ya no están disponibles: {dishes}. Tu pedido se ha quedado vacío. | No longer available: {dishes}. Your order is now empty. |
| `order.priceChanged` | Ha cambiado el precio de: {dishes}. Revisa el nuevo total y confírmalo de nuevo. | The price has changed for: {dishes}. Please check the new total and confirm again. |
| `order.tableUnavailable` | Desde esta mesa ya no se pueden hacer pedidos. Pregunta al personal. | Orders can no longer be placed from this table. Please ask the staff. |
| `order.number` | Pedido nº {number} | Order no. {number} |
| `order.status` | Estado: {status} | Status: {status} |
| `order.status.received` | Recibido | Received |
| `order.receivedHelp` | Lo estamos preparando. Si necesitas algo, pregunta al personal. | We're on it. If you need anything, please ask the staff. |
| `order.backToMenu` | Volver a la carta | Back to the menu |
| `orders.title` | Mis pedidos | My orders |
| `orders.empty` | Todavía no has hecho ningún pedido desde este móvil. | You haven't placed any orders from this phone yet. |
| `orders.placedAt` | Hecho a las {time} | Placed at {time} |
| `admin.tables` | Mesas | Tables |
| `tables.new` | Nueva mesa | New table |
| `tables.name` | Nombre de la mesa (p. ej. «Mesa 4», «Terraza 2») | Table name (e.g. "Table 4", "Patio 2") |
| `tables.archived` | Mesas archivadas | Archived tables |
| `tables.empty` | Aún no hay mesas. Crea tus mesas para que los comensales puedan pedir desde ellas. | No tables yet. Create your tables so diners can order from them. |
| `tables.showQr` | Ver QR de {name} | Show QR for {name} |
| `tables.archivedHint` | Mesa archivada: su QR abre la carta, pero no permite pedir. | Archived table: its QR opens the menu, but ordering is disabled. |
| `qr.print` / `qr.download` | Imprimir / Descargar | Print / Download |
| `qr.cardText` | Escanea para ver la carta y pedir · Scan to see the menu and order | Escanea para ver la carta y pedir · Scan to see the menu and order |
| `qr.urlHint` | Este QR abre: {url} | This QR opens: {url} |
| `error.tableNameTaken` | Ya existe una mesa activa con ese nombre. | There's already an active table with that name. |

Se reutilizan `form.save`, `form.cancel`, `form.charCount`, `admin.edit`, `admin.archive`, `admin.reactivate`, `error.required`, `error.tooLong`, `menu.vatIncluded`. Cualquier texto nuevo durante la implementación se añade a ambos diccionarios (`en.ts` falla en compilación si falta una clave).

### D11. Dependencias

| Dependencia | Tipo | Justificación |
| --- | --- | --- |
| `qrcode-generator` | runtime (solo chunk de administración) | Generar el QR de cada mesa en el navegador. Sin dependencias, licencia MIT, ≈ 8 KB gzip y genera SVG directamente. Alternativas descartadas: escribir un codificador QR propio (Reed-Solomon, máscaras y versiones: cientos de líneas propias que mantener, contra la regla 1); `qrcode` (más pesado y pensado también para Node); un servicio web externo de QR (envía la URL de cada mesa a un tercero y depende de su disponibilidad). No afecta al presupuesto de la carta porque solo lo importa `TableQrPage`. |

Ninguna otra dependencia nueva.

### D12. Estrategia de pruebas

- **pgTAP** (`supabase/tests/05_tables.test.sql`, `06_place_order.test.sql`, `07_order_reads.test.sql`): reglas de mesas y RLS; toda la lógica de `place_order` (es la garantía en servidor); alcance de `get_table` y `get_orders`; que `anon`/`authenticated` no lean ni escriban `orders`, `order_items`, `order_counters` ni `tables` directamente.
- **Vitest + RTL**: reducer del pedido (función pura), pantallas del comensal y de mesas con `fakeSupabase`/`fetch` simulado; contraste de los tokens nuevos en el test existente de `contrastPairs`.
- **Playwright** (solo flujos entre roles): dueño crea la mesa → comensal pide desde su URL; dueño archiva un plato / cambia un precio / archiva la mesa mientras el comensal decide.
- **LHCI**: `/` y `/t/<token>` con las mismas aserciones.

## Risks / Trade-offs

- [Cualquiera con una foto del QR puede pedir desde fuera del local] → aceptado en este cambio: el pedido no implica pago, el personal ve la mesa y el contenido, y el dueño puede archivar la mesa para cortar los pedidos al instante. Regenerar el QR queda en Open Questions; la columna `token` separada lo deja preparado.
- [Pedidos basura masivos contra `place_order` (script)] → tope de 50 líneas y 20 unidades por línea; limitación por IP fuera de alcance (regla 1). Si ocurre, `panel-cocina` puede añadir un filtro; mientras, archivar la mesa.
- [Respuesta perdida tras un pedido registrado y el comensal edita el pedido antes de reintentar] → el `orderId` cambia con la edición y podría registrarse un segundo pedido; el personal lo detecta (mismo número de mesa, minutos de diferencia). Se acepta frente a bloquear la edición tras un error de red, que confundiría al comensal.
- [El borrador guardado en `localStorage` queda con precios antiguos si el comensal vuelve horas después] → la comprobación de D3 lo corrige al confirmar; el comensal ve el aviso y el total nuevo.
- [Contador por día sin huecos pero serializado] → una fila bloqueada durante milisegundos por pedido; irrelevante para el volumen de un bar.
- [El QR generado desde una URL de desarrollo apuntaría a `localhost`] → la tarjeta muestra la URL codificada (D9) y el Migration Plan indica imprimir desde la URL pública.
- [Zona horaria incorrecta en una instancia fuera de la península (p. ej. Canarias)] → `venue_settings.timezone` configurable por instancia (acción manual documentada); con el valor por defecto el error sería solo de una hora en el corte de numeración.
- [JS inicial de la carta por encima de 150 KB gzip con el código del pedido] → subrutas en chunk diferido, botón y barra pequeños, LHCI sobre `/t/<token>`; primera palanca si se supera: mover el selector de tamaño (`<dialog>`) al chunk diferido.

## Migration Plan

Cambio aditivo: no modifica columnas existentes salvo añadir `venue_settings.timezone` con valor por defecto; no hay datos que migrar.

**Acción manual en cada instancia desplegada** (se documenta en `README.md`):
1. Aplicar la migración: `supabase db push` (crea mesas, pedidos, contador, funciones, políticas y la columna `timezone`).
2. Solo si el local no está en la hora peninsular española, en el SQL Editor: `update public.venue_settings set timezone = '<zona IANA, p. ej. Atlantic/Canary>';`.
3. Desplegar el nuevo build del frontend.
4. El dueño, **desde la URL pública de la instancia**, da de alta sus mesas en «Mesas», imprime el QR de cada una y lo coloca en su mesa, retirando el QR genérico anterior (que seguirá abriendo la carta, pero en modo consulta).

Rollback: desplegar el build anterior (la carta en `/` sigue funcionando igual). La migración solo añade objetos; una migración inversa (`drop` de funciones, tablas, tipo y columna) es posible mientras no haya pedidos reales que conservar.

## Open Questions

- ¿Debe el dueño poder **regenerar el QR** de una mesa (QR perdido o copiado)? No cambia nada de este cambio: el `token` separado permite añadirlo después con un `update` y un botón.
- ¿Cuánto tiempo se conservan los pedidos? Hoy no se borran; una política de retención (p. ej. para estadísticas o limpieza) puede decidirse con `panel-cocina`.
