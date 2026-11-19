# Design: add-carta-digital

## Context

- Motivación y decisiones de negocio: ver `proposal.md`. Comportamiento exigido: `specs/menu`, `specs/catalog-management`, `specs/backoffice-access`, `specs/venue-settings`.
- **El repositorio no tiene código todavía** (solo `openspec/`, `README.md`, `.gitignore`). Este cambio arranca la SPA y el proyecto Supabase; las decisiones de estructura que se tomen aquí serán la base del resto de cambios.
- Stack fijado por el proyecto: React 19 + TypeScript + Vite (SPA), TanStack Query, SCSS; Supabase (Postgres, Auth, RLS, Storage); Vitest + React Testing Library; Playwright solo para flujos entre roles.
- Una instancia por local: una única carta y una única fila de datos del local por base de datos, sin columna de local en ninguna tabla.

## Goals / Non-Goals

**Goals:**
- Una carta del comensal ligera, separada en su propio bundle de la administración, que cumpla el presupuesto de < 2 s en las condiciones de referencia definidas abajo.
- Que las reglas de negocio críticas (declaración de alérgenos, regla de precios y tamaños, «Incluidos», no borrado, solo el dueño escribe, platos archivados invisibles para el público) se garanticen **en la base de datos**, no solo en la interfaz.
- Una administración móvil sin gestos complejos (sin arrastrar y soltar).

**Non-Goals:**
- Tiempo real (la carta se actualiza al abrirla o recargarla; ver spec).
- Roles de personal: solo se deja preparada la tabla de usuarios de la zona privada con el rol `owner`.
- Gestión de cuentas de dueño desde la app (alta y baja se hacen al instalar; ver Migration Plan).
- PWA / funcionamiento sin conexión.

## Decisions

### D1. Estructura de la SPA y rutas

```
src/
  main.tsx, App.tsx           # QueryClient, I18nProvider, router
  i18n/{es,en}.ts, I18nProvider.tsx, useT.ts
  lib/{supabase.ts, money.ts, allergens.ts, images.ts}
  styles/{tokens.scss, mixins.scss, global.scss}
  features/menu/              # carta del comensal (bundle inicial)
  features/venue/             # cabecera del local (compartida) + «Mi local» (lazy)
  features/backoffice/        # login, restablecimiento, guardia de sesión (lazy)
  features/catalog/           # administración del catálogo (lazy)
supabase/
  config.toml, migrations/, tests/ (pgTAP), seed.sql
```

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/` | Carta | Público |
| `/admin/login` | Inicio de sesión | Público |
| `/admin/forgot-password` | Pedir enlace de restablecimiento | Público |
| `/admin/reset-password` | Crear contraseña nueva (destino del enlace del correo) | Sesión de recuperación |
| `/admin` | Catálogo: categorías y sus platos (activos / archivados) | Dueño |
| `/admin/categories/new`, `/admin/categories/:id` | Formulario de categoría | Dueño |
| `/admin/dishes/new?category=:id`, `/admin/dishes/:id` | Formulario de plato | Dueño |
| `/admin/venue` | «Mi local»: nombre y logo | Dueño |

Todo `/admin/*` se carga con `React.lazy` para que la carta no descargue código de administración. La cabecera del local (`VenueHeader`) es un componente pequeño compartido por ambas zonas.

**Router: `react-router` (nueva dependencia, justificada).** La administración necesita enlaces profundos (incluido el destino del correo de restablecimiento), botón «atrás» del móvil coherente y redirección tras el login a la pantalla que se intentaba abrir (spec `backoffice-access`). Alternativas: (a) router casero sobre `history.pushState` — reimplementa scroll, back/forward y parámetros, más código propio que mantener; (b) TanStack Router — más potente pero más pesado y con más conceptos de los que necesita una app de 9 rutas. Se usa React Router en modo declarativo (`BrowserRouter` + `Routes`), lo mínimo.

### D2. Modelo de datos (migración `supabase/migrations/20261117000000_carta_digital.sql`)

```sql
-- Alérgenos del Reglamento (UE) 1169/2011, Anexo II
create type public.allergen as enum (
  'gluten','crustaceans','eggs','fish','peanuts','soy','milk',
  'tree_nuts','celery','mustard','sesame','sulphites','lupin','molluscs'
);

-- Usuarios de la zona privada (hoy solo dueños, uno o varios; el personal llegará después)
create table public.backoffice_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner')),
  created_at timestamptz not null default now()
);

-- Datos del local: una sola fila
create table public.venue_settings (
  id         boolean primary key default true check (id),
  name       text check (name is null or char_length(btrim(name)) between 1 and 60),
  logo_path  text,
  updated_at timestamptz not null default now()
);
insert into public.venue_settings (id) values (true);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  is_included boolean not null default false,   -- la categoría del sistema «Incluidos»
  name        text,                              -- null solo en «Incluidos» (nombre traducido por la UI)
  position    integer not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint categories_name_rule check (
    (is_included and name is null)
    or (not is_included
        and char_length(btrim(name)) between 1 and 40
        and lower(btrim(name)) not in ('incluidos', 'included'))),
  constraint categories_included_never_archived check (not (is_included and archived_at is not null))
);
create unique index categories_single_included on public.categories (is_included) where is_included;
create unique index categories_active_name_unique on public.categories (lower(btrim(name)))
  where archived_at is null and not is_included;
create index categories_position_idx on public.categories (position);
insert into public.categories (is_included, position) values (true, 1);

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id) on delete restrict,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  description   text check (description is null or char_length(btrim(description)) between 1 and 160),
  included_with text check (included_with is null or char_length(btrim(included_with)) between 1 and 60),
  photo_path    text,
  allergens     public.allergen[] not null default '{}',
  no_allergens  boolean not null default false,
  position      integer not null,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  -- Exactamente una declaración: lista no vacía XOR «no contiene alérgenos»
  constraint dishes_allergen_declaration check (
    (no_allergens and cardinality(allergens) = 0)
    or (not no_allergens and cardinality(allergens) > 0))
);
create index dishes_category_position_idx on public.dishes (category_id, position);

create table public.dish_sizes (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references public.dishes(id) on delete cascade,
  label       text check (label is null or char_length(btrim(label)) between 1 and 20),
  price_cents integer not null check (price_cents > 0),
  position    integer not null,
  constraint dish_sizes_position_unique unique (dish_id, position) deferrable initially deferred
);
create unique index dish_sizes_label_unique on public.dish_sizes (dish_id, lower(btrim(label)))
  where label is not null;
```

- **Precio en céntimos enteros** (`price_cents > 0`): evita errores de coma flotante; «mayor que 0 con como máximo dos decimales» queda garantizado por el tipo entero. Nunca existe un precio 0 en la base de datos, así que la carta no puede mostrar «0 €».
- **Tamaños en tabla propia** (`dish_sizes`) y no en un `jsonb`: el cambio de pedidos necesitará referenciar un tamaño concreto, y las restricciones (precio > 0, nombres únicos por plato) se expresan como columnas e índices normales.
- **Regla de precios** (cruza tablas, por eso no cabe en un `check`): un *constraint trigger* `deferrable initially deferred` en `dishes` y `dish_sizes` ejecuta `check_dish_price_rule(dish_id)` al confirmar la transacción:
  - si la categoría del plato es «Incluidos» → `included_with` no nulo y **cero** tamaños;
  - si no → `included_with` nulo, **al menos un** tamaño y, si hay más de uno, todos con `label` no nulo.
  Un trigger en `categories` impide cambiar `is_included` después de crearse.
- **«Incluidos»**: una única fila con `is_included = true`, creada por la migración, sin nombre (la UI muestra `category.included`: «Incluidos» / «Included»), no archivable y con posición editable como cualquier otra.
- **Archivado = `archived_at` no nulo.** No hay borrado (D3). Reactivar solo pone `archived_at` a nulo: la `position` se conserva, así que el elemento vuelve a su sitio (spec «El dueño reactiva un plato archivado»).
- **Posición:** entero por ámbito (categorías globales; platos por categoría; tamaños por plato). Un trigger `before insert` asigna `max(position)+1` si llega nulo, y un trigger `before update of category_id` coloca el plato al final de la nueva categoría. Las posiciones pueden tener huecos; solo importa el orden relativo.
- Límites de longitud (categoría 40, plato 80, descripción 160, «incluido con» 60, tamaño 20, local 60 caracteres): decisión técnica para que la carta se lea bien en el móvil; la interfaz muestra el contador.

### D3. RLS y permisos

```sql
create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.backoffice_users
                 where user_id = auth.uid() and role = 'owner');
$$;

alter table public.backoffice_users enable row level security;
alter table public.venue_settings   enable row level security;
alter table public.categories       enable row level security;
alter table public.dishes           enable row level security;
alter table public.dish_sizes       enable row level security;

-- Cada usuario autenticado puede leer solo su propia fila (para saber si es dueño)
create policy "self read" on public.backoffice_users
  for select to authenticated using (user_id = auth.uid());

-- Datos del local: lectura pública, actualización solo del dueño (sin insert/delete)
create policy "public read venue" on public.venue_settings
  for select to anon, authenticated using (true);
create policy "owner update venue" on public.venue_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Lectura pública: solo lo visible en la carta
create policy "public read active categories" on public.categories
  for select to anon, authenticated using (archived_at is null);
create policy "public read active dishes" on public.dishes
  for select to anon, authenticated using (
    archived_at is null and exists (
      select 1 from public.categories c
      where c.id = category_id and c.archived_at is null));
create policy "public read visible sizes" on public.dish_sizes
  for select to anon, authenticated using (
    exists (select 1 from public.dishes d where d.id = dish_id));  -- hereda la RLS de dishes

-- El dueño lee todo (incluido lo archivado) y escribe
create policy "owner read categories" on public.categories
  for select to authenticated using (public.is_owner());
create policy "owner insert categories" on public.categories
  for insert to authenticated with check (public.is_owner() and not is_included);
create policy "owner update categories" on public.categories
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
-- (select/insert/update equivalentes para public.dishes)
-- dish_sizes: select/insert/update/delete para el dueño (los tamaños se sustituyen al editar)

-- Sin políticas DELETE en categorías ni platos: nadie puede borrarlos.
revoke delete on public.categories, public.dishes, public.venue_settings from anon, authenticated;
revoke insert, update, delete on public.categories, public.dishes, public.dish_sizes,
  public.venue_settings from anon;
```

- Las políticas permisivas se combinan con OR: el dueño ve también lo archivado; `anon` solo lo activo. **La consulta de la carta filtra igualmente `archived_at is null`** en categorías y platos, para que un dueño con sesión abierta vea en `/` exactamente lo mismo que un comensal.
- `backoffice_users` no tiene políticas de escritura: el alta de dueños se hace con el rol de servicio (acción manual, Migration Plan). Varios dueños = varias filas con `role = 'owner'`; todos pasan `is_owner()` por igual.

### D4. Guardado del plato y reordenación con RPC atómicas

```sql
-- Crea o actualiza el plato y sustituye sus tamaños en una sola transacción
create function public.save_dish(p_dish jsonb, p_sizes jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$ ... $$;

create function public.move_dish(p_id uuid, p_direction integer)      -- -1 sube, +1 baja
returns void language plpgsql security invoker set search_path = '' as $$ ... $$;
create function public.move_category(p_id uuid, p_direction integer)
returns void language plpgsql security invoker set search_path = '' as $$ ... $$;
```

- `save_dish` inserta o actualiza la fila de `dishes`, borra los tamaños que ya no vienen, actualiza o inserta el resto con su `position` y devuelve el id. El *constraint trigger* de D2 valida la regla de precios al final, así que un plato nunca queda guardado a medias. Al ser `security invoker`, RLS sigue aplicando.
- Al mover un plato a «Incluidos» el formulario deja de enviar tamaños y envía `included_with`; al sacarlo, al revés. La base de datos rechaza cualquier combinación inválida.
- `move_*` buscan el vecino **activo** más cercano en la dirección indicada (mismo `category_id` en platos) e intercambian ambas `position`; si no hay vecino, no hacen nada.
- Alternativas descartadas: arrastrar y soltar (requiere librería, difícil con lector de pantalla y con el pulgar; viola la regla 1) o escribir plato y tamaños con varias peticiones desde el cliente (riesgo de estados intermedios inválidos).
- Nota para el cambio de pedidos: hoy, quitar un tamaño lo borra. Si los pedidos referencian tamaños, ese cambio decidirá entre copiar nombre y precio en el pedido o archivar tamaños (proposal, decisión del 2026-11-19).

### D5. Imágenes: Supabase Storage + redimensionado en el navegador

- Un único bucket público `images` creado en la migración: `public = true`, `file_size_limit = 5242880` (5 MB), `allowed_mime_types = {image/jpeg, image/png}`. Políticas de `storage.objects`: lectura pública; `insert`/`update`/`delete` solo si `public.is_owner()` y `bucket_id = 'images'`.
- Utilidad común `src/lib/images.ts`:
  1. Valida **el archivo original**: tipo `image/jpeg|png|webp` y tamaño ≤ 5 MB. Si falla, devuelve el error (`error.photoTooLarge` / `error.photoType`) y el formulario conserva el resto de datos.
  2. Redimensiona con `createImageBitmap` + `<canvas>`, sin dependencias: **fotos de plato** a un máximo de 960 px y JPEG calidad 0,8 (≈ 60–150 KB; JPEG porque `toBlob('image/webp')` no está garantizado en todos los Safari); **logo** a un máximo de 512 px en PNG, para conservar la transparencia.
  3. Sube a `dishes/<dish_id>/<uuid>.jpg` o `venue/logo-<uuid>.png` con `cacheControl: '31536000'` (nombre nuevo en cada sustitución → caché inmutable) y después actualiza `photo_path` / `logo_path`. Al sustituir o quitar se borra el objeto anterior (best effort: si falla, queda un huérfano inofensivo).
- El límite del bucket es la barrera en servidor; como el archivo subido siempre es el redimensionado, no debería alcanzarse en uso normal.
- Alternativa descartada: transformaciones de imagen de Supabase (plan de pago y una pieza más por instancia).

### D6. Carga y presentación de la carta

- Dos peticiones en paralelo vía `supabase-js` (PostgREST):
  - catálogo: `categories?select=id,is_included,name,position,dishes(id,name,description,included_with,photo_path,allergens,no_allergens,position,dish_sizes(id,label,price_cents,position))&archived_at=is.null&dishes.archived_at=is.null&order=position&dishes.order=position&dishes.dish_sizes.order=position`;
  - local: `venue_settings?select=name,logo_path` (una fila).
- La función pura `visibleCategories` descarta las categorías sin platos (también «Incluidos») y resuelve el nombre de «Incluidos» con `t('category.included')`. Si no queda ninguna → estado «carta no disponible» (sin índice). Si falla la petición del catálogo → estado de error con «Reintentar» (`refetch`). Si falla solo la del local, la cabecera usa el título genérico.
- Presentación de cada plato (función pura `priceLines`): un tamaño sin nombre → «1,80 €»; un tamaño con nombre → «Ración · 7,00 €»; varios → una línea por tamaño en su orden; plato de «Incluidos» → el texto `included_with` tal cual, sin precio.
- Orden de la página: cabecera del local (logo + nombre, o `menu.title`) y selector de idioma → aviso de alergias (fijo, no se puede cerrar) → índice de categorías (`<nav aria-label>` con enlaces a anclas `#cat-<id>`, sin quedarse fijo al hacer scroll; `scroll-margin-top` en los encabezados) → nota «Precios con IVA incluido» → categorías.
- TanStack Query: `staleTime` 60 s, `refetchOnWindowFocus: true`, `retry: 1` (para mostrar el error pronto). Las consultas se lanzan al cargar el módulo (prefetch en `main.tsx`) para no esperar al primer render.
- `<link rel="preconnect">` al dominio de Supabase en `index.html` (URL inyectada en build con `%VITE_SUPABASE_URL%`).
- Fotos: `<img>` con `width`/`height` fijos (relación 4:3, sin saltos de diseño), `loading="lazy"` y `decoding="async"`, salvo las dos primeras del listado y el logo, que van `eager`. Un plato sin foto no reserva hueco.

### D7. Condiciones de medición del rendimiento (requisito «Rendimiento de la carta»)

| Parámetro | Valor |
| --- | --- |
| Herramienta | Lighthouse CI (`@lhci/cli`), 3 ejecuciones, se toma la mediana |
| Dispositivo | Perfil móvil por defecto de Lighthouse (gama media, pantalla 412×823, CPU 4× más lenta) |
| Red | Throttling simulado por defecto de Lighthouse: RTT 150 ms, 1,6 Mbps bajada, 750 Kbps subida (perfil «4G lento»; más exigente que un 4G típico, a propósito) |
| Caché | Fría (primera visita) |
| Build | Producción (`vite build` + `vite preview`) contra Supabase local |
| Carta de referencia | `supabase/seed.sql`: local con nombre y logo, 8 categorías más «Incluidos» (2 platos), 60 platos activos (40 con foto ya redimensionada, 15 con 2–3 tamaños), 10 platos archivados |
| Métrica y umbral | **Largest Contentful Paint < 2 000 ms** |
| Presupuesto auxiliar | JS inicial de la ruta `/` ≤ 150 KB gzip (aserción `resource-summary:script:size` de LHCI) |

«Contenido principal visible» se mide como LCP; para que el LCP corresponda a contenido real de la carta, el estado de carga es un indicador pequeño (no un esqueleto a pantalla completa).

### D8. Internacionalización sin librería

- Diccionarios tipados `src/i18n/es.ts` (fuente de verdad de las claves) y `src/i18n/en.ts` (`satisfies Messages`, de modo que TypeScript falla si falta una clave en inglés). Hook `useT()` e `I18nProvider` en React context; interpolación simple `{name}`.
- **Idioma por defecto según la zona**: la carta (`/`) arranca en `en`; la administración (`/admin/*`, incluidos login y restablecimiento) arranca en `es`. Cada zona recuerda su elección en `localStorage` por separado (`menu-now.lang.menu`, `menu-now.lang.admin`), con try/catch; no es un dato personal ni identifica a nadie. El idioma activo se refleja en `<html lang>`.
- Precios con `Intl.NumberFormat` y `currency: 'EUR'`: `es-ES` → «2,50 €», `en-IE` → «€2.50». El dueño introduce los precios aceptando coma o punto decimal; `parsePriceToCents` es una función pura con tests.
- Alternativa descartada: `react-i18next`/`i18next` (≈ 15 KB gzip y configuración) para ~110 cadenas y dos idiomas, contra la regla 1 y el presupuesto de D7.

**Textos de interfaz (es / en).** Lista inicial; cualquier texto nuevo durante la implementación se añade a ambos diccionarios.

| Clave | es | en |
| --- | --- | --- |
| `menu.title` | Carta | Menu |
| `menu.index` | Categorías | Categories |
| `menu.allergyNotice` | Si tienes alguna alergia o intolerancia, consulta al personal. | If you have any allergy or intolerance, please ask the staff. |
| `menu.empty` | La carta todavía no está disponible. Pregunta al personal. | The menu isn't available yet. Please ask the staff. |
| `menu.error` | No hemos podido cargar la carta. | We couldn't load the menu. |
| `menu.retry` | Reintentar | Try again |
| `menu.loading` | Cargando la carta… | Loading the menu… |
| `menu.allergens` | Alérgenos | Allergens |
| `menu.noAllergens` | No contiene alérgenos de declaración obligatoria | Contains none of the allergens that must be declared |
| `menu.vatIncluded` | Precios con IVA incluido | Prices include VAT |
| `menu.sizePrice` | {size} · {price} | {size} · {price} |
| `category.included` | Incluidos | Included |
| `lang.label` | Idioma | Language |
| `lang.es` / `lang.en` | Español / English | Español / English |
| `allergen.gluten` | Gluten | Gluten |
| `allergen.crustaceans` | Crustáceos | Crustaceans |
| `allergen.eggs` | Huevos | Eggs |
| `allergen.fish` | Pescado | Fish |
| `allergen.peanuts` | Cacahuetes | Peanuts |
| `allergen.soy` | Soja | Soy |
| `allergen.milk` | Leche | Milk |
| `allergen.tree_nuts` | Frutos de cáscara | Tree nuts |
| `allergen.celery` | Apio | Celery |
| `allergen.mustard` | Mostaza | Mustard |
| `allergen.sesame` | Sésamo | Sesame |
| `allergen.sulphites` | Sulfitos | Sulphites |
| `allergen.lupin` | Altramuces | Lupin |
| `allergen.molluscs` | Moluscos | Molluscs |
| `auth.title` | Acceso del dueño | Owner sign-in |
| `auth.email` / `auth.password` | Correo electrónico / Contraseña | Email / Password |
| `auth.submit` | Entrar | Sign in |
| `auth.invalid` | Correo o contraseña incorrectos. | Incorrect email or password. |
| `auth.notOwner` | Esta cuenta no tiene acceso a la administración. | This account can't access the admin area. |
| `auth.signOut` | Cerrar sesión | Sign out |
| `auth.forgot` | ¿Has olvidado tu contraseña? | Forgot your password? |
| `auth.resetTitle` | Restablecer contraseña | Reset password |
| `auth.resetRequest` | Enviar enlace | Send link |
| `auth.resetSent` | Si el correo corresponde a una cuenta, recibirás un enlace para crear una contraseña nueva. | If that email belongs to an account, you'll receive a link to create a new password. |
| `auth.newPassword` | Contraseña nueva | New password |
| `auth.resetSave` | Guardar contraseña | Save password |
| `auth.resetDone` | Contraseña actualizada. | Password updated. |
| `auth.resetInvalid` | El enlace no es válido o ha caducado. Pide uno nuevo. | This link is invalid or has expired. Please request a new one. |
| `auth.backToLogin` | Volver a iniciar sesión | Back to sign-in |
| `admin.title` | Mi carta | My menu |
| `admin.viewMenu` | Ver la carta | View menu |
| `admin.venue` | Mi local | My venue |
| `admin.newCategory` / `admin.newDish` | Nueva categoría / Nuevo plato | New category / New dish |
| `admin.edit` | Editar | Edit |
| `admin.moveUp` / `admin.moveDown` | Subir {name} / Bajar {name} | Move {name} up / Move {name} down |
| `admin.archive` / `admin.reactivate` | Archivar / Reactivar | Archive / Restore |
| `admin.archived` | Archivados | Archived |
| `admin.archivedOn` | Archivado el {date} | Archived on {date} |
| `admin.categoryHidden` | Sin platos activos: no se muestra en la carta. | No active dishes: not shown on the menu. |
| `admin.categoryArchivedHint` | Categoría archivada: ni ella ni sus platos se muestran en la carta. | Archived category: neither it nor its dishes are shown on the menu. |
| `admin.includedHint` | Categoría del sistema para lo que va incluido con otra compra. No se puede renombrar ni archivar. | System category for items included with another purchase. It can't be renamed or archived. |
| `admin.empty` | Aún no hay platos. Crea una categoría y añade tu primer plato. | No dishes yet. Create a category and add your first dish. |
| `form.save` / `form.cancel` | Guardar / Cancelar | Save / Cancel |
| `form.saved` | Cambios guardados. Ya se ven en la carta. | Changes saved. They're now on the menu. |
| `form.saveError` | No se han podido guardar los cambios. Inténtalo de nuevo. | Changes couldn't be saved. Please try again. |
| `form.category` | Categoría | Category |
| `form.name` | Nombre | Name |
| `form.description` | Descripción corta (opcional) | Short description (optional) |
| `form.sizes` | Tamaños y precios (€, IVA incluido) | Sizes and prices (€, VAT included) |
| `form.sizeLabel` | Tamaño (p. ej. «Ración»; opcional si solo hay uno) | Size (e.g. "Portion"; optional if there's only one) |
| `form.sizePrice` | Precio | Price |
| `form.addSize` | Añadir tamaño | Add size |
| `form.removeSize` | Quitar tamaño {label} | Remove size {label} |
| `form.includedWith` | ¿Con qué compra se incluye? | Included with which purchase? |
| `form.includedWithHint` | Por ejemplo: «Con cada bebida». Se muestra en lugar del precio. | For example: "With every drink". Shown instead of the price. |
| `form.charCount` | {count}/{max} | {count}/{max} |
| `form.allergens` | Alérgenos | Allergens |
| `form.noAllergens` | No contiene alérgenos de declaración obligatoria | Contains none of the allergens that must be declared |
| `form.photo` | Foto (opcional) | Photo (optional) |
| `form.photoChoose` / `form.photoReplace` / `form.photoRemove` | Elegir foto / Cambiar foto / Quitar foto | Choose photo / Change photo / Remove photo |
| `venue.name` | Nombre del local | Venue name |
| `venue.logo` | Logo (opcional) | Logo (optional) |
| `venue.logoChoose` / `venue.logoReplace` / `venue.logoRemove` | Elegir logo / Cambiar logo / Quitar logo | Choose logo / Change logo / Remove logo |
| `venue.missingName` | Añade el nombre de tu local para que aparezca en la carta. | Add your venue's name so it appears on the menu. |
| `error.required` | Este campo es obligatorio. | This field is required. |
| `error.tooLong` | Máximo {max} caracteres. | Maximum {max} characters. |
| `error.price` | El precio debe ser mayor que cero, con como máximo dos decimales. | The price must be greater than zero, with at most two decimals. |
| `error.priceZero` | El precio debe ser mayor que cero. Lo que va sin precio se pone en «Incluidos». | The price must be greater than zero. Items with no price go in "Included". |
| `error.sizeLabelRequired` | Si hay varios tamaños, cada uno necesita un nombre. | If there are several sizes, each one needs a name. |
| `error.sizeLabelDuplicate` | Ya hay un tamaño con ese nombre en este plato. | This dish already has a size with that name. |
| `error.categoryNameTaken` | Ya existe una categoría activa con ese nombre. | There's already an active category with that name. |
| `error.categoryNameReserved` | Ese nombre está reservado para la categoría «Incluidos». | That name is reserved for the "Included" category. |
| `error.allergenDeclaration` | Marca los alérgenos del plato o «No contiene alérgenos de declaración obligatoria». | Select the dish's allergens or "Contains none of the allergens that must be declared". |
| `error.photoTooLarge` | La imagen pesa demasiado. El tamaño máximo es 5 MB. | The image is too large. The maximum size is 5 MB. |
| `error.photoType` | Formato no admitido. Usa una imagen JPEG, PNG o WebP. | Unsupported format. Use a JPEG, PNG or WebP image. |
| `error.passwordShort` | La contraseña debe tener al menos 8 caracteres. | The password must be at least 8 characters long. |
| `common.notFound` | Esta página no existe. | This page doesn't exist. |

### D9. Sesión y cuentas de dueño (Supabase Auth)

- Correo + contraseña con `supabase.auth.signInWithPassword`. Cualquier error de credenciales se muestra con `auth.invalid` (no se distingue «correo inexistente»).
- Guardia `RequireOwner` en las rutas de dueño: sin sesión → redirige a `/admin/login?next=<ruta>`; con sesión pero sin fila `owner` en `backoffice_users` → cierra sesión y muestra `auth.notOwner`. Tras el login se navega a `next` (solo rutas internas que empiecen por `/admin`, para evitar redirecciones abiertas). La garantía real está en RLS (D3).
- **Restablecimiento**: `/admin/forgot-password` llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origen>/admin/reset-password })` y muestra siempre `auth.resetSent`, haya error de «usuario no encontrado» o no (Supabase no envía correo a direcciones sin cuenta). `/admin/reset-password` espera el evento `PASSWORD_RECOVERY` de la sesión de recuperación, valida ≥ 8 caracteres en cliente y llama a `supabase.auth.updateUser({ password })`; sin sesión de recuperación válida (enlace caducado o usado) muestra `auth.resetInvalid`. Caducidad del enlace: la de Supabase (1 h por defecto); un solo uso: garantizado por Supabase.
- Longitud mínima 8: `minimum_password_length = 8` en `supabase/config.toml` y en la configuración de Auth de cada instancia.
- **Varios dueños**: cada dueño es un usuario de Auth con su fila en `backoffice_users`; no hay pantalla para gestionarlos en este cambio.
- Registro público desactivado: `enable_signup = false` en `supabase/config.toml` (local) y en la configuración de Auth de cada instancia (acción manual). La interfaz no tiene ningún enlace de registro.

### D10. Accesibilidad y diseño visual

- Tokens en `styles/tokens.scss` (colores, tipografía, espaciado). Paleta de alto contraste: texto `#111111` sobre `#FFFFFF`; texto secundario `#333333`; chips de alérgenos `#111111` sobre `#FFF1C2` con borde `#111111`; aviso de alergias `#111111` sobre `#FFE08A` con borde; acento/enlaces `#0B3D5C`. **Todos los pares texto/fondo ≥ 7:1**, verificado por un test unitario que calcula el contraste WCAG de cada par declarado en un mapa `contrastPairs` exportado junto a los tokens (sin dependencias).
- Mixin `tap-target` (`min-width`/`min-height: 44px`) aplicado a todo control, incluidos los enlaces del índice; tamaño de texto base 18 px, `rem` en todo para respetar el zoom del sistema; sin `maximum-scale` en el viewport.
- Estructura semántica: cabecera con el logo (`alt` = nombre del local) y `h1` con el nombre del local o `menu.title`; aviso de alergias como texto en una región `role="note"`; índice en `<nav aria-label={t('menu.index')}>`; `h2` por categoría; cada plato `article` con `h3`; tamaños y precios en una lista; alérgenos en una lista con etiqueta visible «Alérgenos», nunca solo iconos ni color. Selector de idioma como dos botones con `aria-pressed`. Estados de carga/error en `role="status"`/`role="alert"`.
- Verificación: aserción LHCI `categories:accessibility = 1` (axe-core en Chrome real, incluye contraste AA y `target-size`), más el test de contraste 7:1 de tokens, más una revisión manual con VoiceOver/TalkBack y a 360 px de ancho registrada en tasks.

### D11. Dependencias

Del stack declarado (sin justificación adicional): `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `sass`, `@tanstack/react-query`, `@supabase/supabase-js`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`.

Nuevas, con justificación:

| Dependencia | Tipo | Justificación |
| --- | --- | --- |
| `react-router` | runtime | Ver D1: enlaces profundos (incluido el destino del correo de restablecimiento), «atrás» del móvil y redirección tras login con el mínimo código propio. |
| `supabase` (CLI) | dev | Necesaria para versionar y aplicar migraciones, levantar Supabase local (con Inbucket para ver los correos de restablecimiento) para tests de integración/e2e y ejecutar pgTAP (`supabase test db`). Sin ella no hay forma reproducible de cumplir la regla de incluir migración y RLS. |
| `@lhci/cli` | dev | Única forma reproducible y automatizable de verificar el requisito de < 2 s en las condiciones de D7 y la auditoría de accesibilidad en navegador real; Playwright queda reservado a flujos entre roles. |

### D12. Estrategia de pruebas

- **Vitest + RTL** (jsdom, cliente Supabase simulado con un módulo falso): comportamiento de pantallas y funciones puras.
- **pgTAP** (`supabase/tests/*.sql`, `supabase test db`): restricciones, regla de precios, «Incluidos» y RLS — la garantía en servidor de las reglas críticas.
- **Vitest de integración** (`*.int.test.ts`, contra Supabase local): solo lo que no se puede probar en SQL (Auth: alta rechazada y restablecimiento con correo real en Inbucket; límite del bucket de Storage).
- **Playwright**: un único flujo entre roles (dueño gestiona → comensal ve).
- **LHCI**: rendimiento y accesibilidad de la carta.

## Risks / Trade-offs

- [Presupuesto de 2 s con «4G lento» simulado y una SPA que necesita dos peticiones a Supabase] → bundle de la carta separado, prefetch de ambas consultas en el arranque y en paralelo, `preconnect`, imágenes diferidas, logo pequeño. Si no se cumple, primera palanca: sustituir `supabase-js` en la ruta `/` por `fetch` directo al endpoint REST (≈ 30 KB gzip menos) sin cambiar la spec.
- [**El restablecimiento de contraseña exige SMTP propio en cada instancia**: el correo integrado de Supabase solo envía a direcciones del equipo del proyecto y con límites muy bajos] → paso obligatorio en el Migration Plan; coste posible de un proveedor de correo transaccional (suelen tener un plan gratuito suficiente para un local). Si una instancia no lo configura, el resto de la app funciona, pero el dueño no recibirá el enlace.
- [Latencia de la región del proyecto Supabase respecto al local] → crear cada proyecto en la región UE más cercana (instrucción de instalación).
- [El dueño puede tardar en ver un cambio reflejado si un comensal tiene la carta abierta] → aceptado: la spec habla de «abrir o recargar»; `refetchOnWindowFocus` mitiga.
- [Fotos HEIC de iPhone] → iOS convierte a JPEG al elegir desde `<input type="file" accept="image/*">`; si llega un HEIC, se rechaza con `error.photoType`.
- [Objetos huérfanos en Storage si falla el borrado de la imagen anterior] → aceptado: coste despreciable; no afecta a la carta.
- [Posiciones con huecos o duplicadas tras ediciones simultáneas de dos dueños] → orden secundario por `created_at` en las consultas; `save_dish` es atómica, y lo peor que puede pasar es que gane el último guardado.
- [Contraste 7:1 y objetivos de 44 px no son auditados como tales por axe (usa AA)] → test de tokens + revisión manual documentada.

## Migration Plan

Primer despliegue (no hay datos previos ni rollback de datos que considerar).

**Acción manual en cada instancia desplegada** (se documenta en el `README.md`):
1. Aplicar migraciones: `supabase link --project-ref <ref>` y `supabase db push` (crea tablas, RLS, funciones, la categoría «Incluidos», la fila de datos del local y el bucket `images`).
2. Configurar Supabase Auth en el Dashboard:
   - desactivar «Allow new users to sign up»;
   - longitud mínima de contraseña: 8;
   - **Site URL** = URL pública de la instancia y añadir `<URL>/admin/reset-password` a las **Redirect URLs**;
   - **SMTP propio** (proveedor de correo transaccional) con un remitente del local, y revisar la plantilla «Reset password» (es/en según el idioma del dueño).
3. Crear cada cuenta de dueño (repetir por dueño): Dashboard → Authentication → Add user (correo + contraseña, «Auto confirm»), y después en el SQL Editor:
   `insert into public.backoffice_users (user_id, role) select id, 'owner' from auth.users where email = '<correo del dueño>';`
   Para retirar a un dueño: borrar su usuario en Authentication (su fila desaparece en cascada).
4. Configurar el frontend con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de la instancia y desplegar el build estático con fallback de SPA (todas las rutas → `index.html`).
5. Pedir al dueño que ponga el nombre y el logo en «Mi local», y generar el QR de las mesas apuntando a la URL raíz de la instancia (la misma para todas las mesas en este cambio).

Rollback: desplegar el build anterior; la migración solo añade objetos, así que puede revertirse con una migración inversa (`drop` de tablas, tipo, funciones y bucket) si fuese necesario antes de tener datos reales.

## Open Questions

- Proveedor de correo transaccional recomendado para las instancias (afecta solo a la configuración y al coste, no al código).
- Proveedor de hosting del frontend estático (Netlify, Vercel, Cloudflare Pages…): no afecta al código más allá del fallback de SPA.
