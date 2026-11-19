# Proposal: add-carta-digital

## Why

Las cartas plastificadas de los bares de barrio están casi siempre desactualizadas: cambiar un precio o un plato obliga a reimprimir. Menu-now necesita su primera pieza visible: una carta digital que el dueño mantiene al día desde su móvil y que el comensal consulta desde el suyo al escanear el QR de la mesa, sin instalar nada ni identificarse. Es la base sobre la que se construirá el pedido desde la mesa (siguiente cambio).

## Roles afectados

- **Comensal (diner)**: consulta la carta pública desde su móvil, sin identificarse.
- **Dueño (owner)**: inicia sesión y gestiona el catálogo (categorías y platos) y los datos del local (nombre y logo) desde una administración pensada para el móvil.
- **Personal (staff)**: no afectado por este cambio.

## What Changes

- Nueva **carta pública** para el comensal: nombre y logo del local, índice de categorías, aviso de alergias, categorías en el orden definido por el dueño y platos activos en orden manual. Cada plato muestra nombre, sus tamaños con precio (€, IVA incluido) —o, si es un plato incluido, con qué compra se incluye—, descripción corta si la tiene, foto opcional y alérgenos siempre visibles. Es la misma para todas las mesas y no requiere identificación.
- Nueva **administración del catálogo** para el dueño: crear, editar, archivar, reactivar y reordenar categorías y platos; tamaños libres por plato; categoría del sistema «Incluidos»; una foto por plato (máximo 5 MB). Los cambios se publican al guardar.
- Nuevos **datos del local**: el dueño edita el nombre y el logo, que se muestran en la carta y en la administración.
- Nuevo **acceso a la administración**: exige sesión de dueño; puede haber varios dueños, cada uno con su cuenta; restablecimiento de contraseña por correo; no existe registro público de cuentas.
- Interfaz en español e inglés: la carta del comensal se abre en inglés y la administración en español; el contenido escrito por el dueño se muestra tal cual.
- Objetivos medibles de rendimiento (carga < 2 s en móvil de gama media con 4G) y accesibilidad (WCAG 2.2 AA, contraste de texto ≥ 7:1, objetivos táctiles ≥ 44×44 CSS px) para la carta del comensal.

## Capabilities

### New Capabilities

- `menu`: la carta pública que consulta el comensal — qué se muestra, en qué orden, cómo se presentan precios, tamaños y alérgenos, índice, aviso de alergias, estados vacíos, idioma, rendimiento y accesibilidad.
- `catalog-management`: la gestión del catálogo por parte del dueño — categorías (incluida «Incluidos»), platos, tamaños y precios, orden, archivado, declaración de alérgenos, fotos, publicación y sus validaciones.
- `backoffice-access`: el acceso a la zona privada (administración) mediante sesión — cuentas de dueño, inicio y cierre de sesión, restablecimiento de contraseña y ausencia de registro público; el personal la reutilizará más adelante.
- `venue-settings`: los datos propios del local (nombre y logo) que edita el dueño y que identifican la carta y la administración.

### Modified Capabilities

Ninguna (no hay especificaciones vivas todavía).

## Decisiones de negocio

| Fecha | Decisión |
| --- | --- |
| 2026-11-17 | La carta se organiza en categorías definidas por el dueño, en el orden que él elija, y los platos tienen orden manual dentro de cada categoría. |
| 2026-11-17 | Un plato activo es un plato no archivado. Los platos archivados nunca aparecen en la carta, pero se conservan en el sistema porque los pedidos futuros los referenciarán. No existe el borrado de platos ni de categorías: solo el archivado. |
| 2026-11-17 | El dueño puede reactivar un plato o una categoría archivados (para que un archivado por error no sea irreversible). |
| 2026-11-17 | Una categoría archivada no se muestra al comensal, y tampoco sus platos, aunque estén activos. Una categoría sin platos activos tampoco se muestra. |
| 2026-11-17 | ~~Cada plato tiene nombre, precio, descripción corta, foto opcional y declaración de alérgenos. Solo la foto es opcional.~~ *Sustituida el 2026-11-19 (tamaños, «Incluidos» y descripción opcional).* |
| 2026-11-17 | Se usan los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011, Anexo II. Se muestran siempre junto a cada plato del listado, como texto, sin interacción adicional. |
| 2026-11-17 | Cada plato declara sus alérgenos o declara explícitamente que no contiene ninguno; no se puede guardar un plato sin una de las dos declaraciones, ni con las dos a la vez. |
| 2026-11-17 | La carta es pública, se consulta sin identificarse y es la misma para todas las mesas; la identificación de mesa llega con el cambio de pedidos. |
| 2026-11-17 | Límite de tamaño de la foto de un plato: **5 MB** por archivo elegido por el dueño. |
| 2026-11-17 | Rendimiento: la carta carga en menos de 2 s en un móvil de gama media con 4G; las condiciones exactas de medición se fijan en design. |
| 2026-11-17 | Accesibilidad de la carta del comensal: WCAG 2.2 AA y, además, contraste de texto ≥ 7:1 y objetivos táctiles ≥ 44×44 CSS px (más exigente que AA, por la regla 4 de accesibilidad real). |
| 2026-11-17 | ~~Interfaz en español (por defecto) e inglés.~~ *Sustituida el 2026-11-19 (idioma por defecto según pantalla).* El contenido escrito por el dueño (nombres y descripciones de platos y categorías) no se traduce. |
| 2026-11-17 | ~~La cuenta del dueño se da de alta al instalar cada local.~~ *Sustituida el 2026-11-19 (varios dueños).* No hay registro público de cuentas. |
| 2026-11-19 | Un plato tiene uno o varios **tamaños** definidos libremente por el dueño (p. ej. «Una», «Ración», «Plato»), cada uno con su precio mayor que 0 y en el orden que él elija. Con un solo tamaño, el nombre del tamaño es opcional y la carta muestra solo el precio; con varios, cada tamaño necesita un nombre distinto. Los alérgenos son los mismos para todos los tamaños. El comensal ve todos los tamaños con su precio; elegir tamaño llegará con los pedidos. |
| 2026-11-19 | Nunca se muestra «0 €» en la carta. Existe una categoría del sistema **«Incluidos»** («Included» en inglés), que no se puede renombrar ni archivar pero sí reordenar. Sus platos no tienen precio y exigen un texto escrito por el dueño que indica con qué compra se incluyen (p. ej. «Con cada bebida»); ese texto ocupa el lugar del precio. Fuera de «Incluidos» no se admite precio 0. Ninguna otra categoría puede llamarse «Incluidos» ni «Included». |
| 2026-11-19 | La descripción corta del plato es **opcional**; si está vacía, la carta no muestra nada en su lugar. |
| 2026-11-19 | La carta del comensal se abre en **inglés** por defecto; la administración (incluido el inicio de sesión) en **español** por defecto. Cada una recuerda en ese dispositivo el idioma elegido. Se actualiza la regla de idiomas de `openspec/config.yaml`. |
| 2026-11-19 | No se declaran trazas («puede contener»): quedan fuera de alcance. Un plato sin alérgenos muestra «No contiene alérgenos de declaración obligatoria» (en lugar de «Sin alérgenos»), y la carta muestra un aviso fijo: «Si tienes alguna alergia o intolerancia, consulta al personal». |
| 2026-11-19 | Publicación inmediata: un cambio guardado por el dueño aparece en la carta al abrirla o recargarla. No hay borradores; para preparar un plato sin mostrarlo, el dueño lo crea y lo archiva. |
| 2026-11-19 | El dueño puede restablecer su contraseña por correo desde la pantalla de inicio de sesión. |
| 2026-11-19 | Puede haber **varios dueños**, cada uno con su propia cuenta y los mismos permisos. Las cuentas se dan de alta al instalar el local. |
| 2026-11-19 | La carta muestra un **índice de categorías** en la parte superior que lleva a cada categoría. |
| 2026-11-19 | El dueño edita el **nombre y el logo** del local desde la administración; se muestran en la carta y en la administración. Sin logo, solo se muestra el nombre. |
| 2026-11-19 | Un plato pertenece a una sola categoría (si debe aparecer en dos, se duplica). Se permiten nombres de plato repetidos; no se permiten dos categorías activas con el mismo nombre. Un plato reactivado vuelve a su posición anterior en la categoría. |
| 2026-11-19 | Editar un plato cambia lo que se ve en la carta desde ese momento. Que un pedido conserve el nombre, tamaño y precio que tenía al hacerse se decidirá en el cambio de pedidos (entrega pendiente para ese cambio). |

## Fuera de alcance

- El pedido desde la mesa, la identificación de mesa y la selección de tamaño por el comensal (siguiente cambio).
- El panel de cocina / personal.
- La disponibilidad temporal de platos («agotado»).
- Precios por franjas horarias.
- Una lista común de tamaños para todo el local.
- La declaración de trazas («puede contener»).
- Filtrar u ocultar platos por alérgeno.
- La traducción del contenido escrito por el dueño.
- Cualquier cuenta o registro del comensal (prohibido por la regla 2, privacidad por diseño).

## Impact

- **Proyecto nuevo**: el repositorio aún no tiene código; este cambio arranca la SPA (React 19 + Vite + TypeScript + TanStack Query + SCSS) y el proyecto Supabase local (migraciones, RLS, Storage).
- **Supabase**: tablas de categorías, platos, tamaños, datos del local y usuarios de la zona privada; políticas RLS; bucket de imágenes con límite de tamaño; correo de restablecimiento de contraseña.
- **Acción manual por instancia**: aplicar migraciones, crear las cuentas de dueño, desactivar el registro público, configurar el envío de correo (SMTP) y las URL de redirección de Supabase Auth (detallado en design).
- **Proyecto**: se actualiza la regla de idiomas en `openspec/config.yaml` y `README.md`.
- **Dependencias**: las del stack declarado más las justificadas en design.
