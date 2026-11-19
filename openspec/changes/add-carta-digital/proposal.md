# Proposal: add-carta-digital

## Why

Las cartas plastificadas de los bares de barrio están casi siempre desactualizadas: cambiar un precio o un plato obliga a reimprimir. Menu-now necesita su primera pieza visible: una carta digital que el dueño mantiene al día desde su móvil y que el comensal consulta desde el suyo al escanear el QR de la mesa, sin instalar nada ni identificarse. Es la base sobre la que se construirá el pedido desde la mesa (siguiente cambio).

## Roles afectados

- **Comensal (diner)**: consulta la carta pública desde su móvil, sin identificarse.
- **Dueño (owner)**: inicia sesión y gestiona el catálogo (categorías y platos) desde una administración pensada para el móvil.
- **Personal (staff)**: no afectado por este cambio.

## What Changes

- Nueva **carta pública** para el comensal: categorías en el orden definido por el dueño, platos activos en orden manual, con nombre, precio (€, IVA incluido), descripción corta, foto opcional y alérgenos siempre visibles. Es la misma para todas las mesas y no requiere identificación.
- Nueva **administración del catálogo** para el dueño: crear, editar, archivar, reactivar y reordenar categorías y platos; subir una foto por plato (máximo 5 MB).
- Nuevo **acceso a la administración**: la administración exige la sesión del dueño; no existe registro público de cuentas.
- Interfaz en español (por defecto) e inglés en todas las pantallas; el contenido escrito por el dueño se muestra tal cual.
- Objetivos medibles de rendimiento (carga < 2 s en móvil de gama media con 4G) y accesibilidad (WCAG 2.2 AA, contraste de texto ≥ 7:1, objetivos táctiles ≥ 44×44 CSS px) para la carta del comensal.

## Capabilities

### New Capabilities

- `menu`: la carta pública que consulta el comensal — qué se muestra, en qué orden, cómo se presentan los alérgenos, estados vacíos, idioma de la interfaz, rendimiento y accesibilidad.
- `catalog-management`: la gestión del catálogo por parte del dueño — categorías, platos, orden, archivado, declaración de alérgenos, fotos y sus validaciones.
- `backoffice-access`: el acceso a la zona privada (administración) mediante sesión; en este cambio solo para el dueño, y el personal la reutilizará más adelante.

### Modified Capabilities

Ninguna (no hay especificaciones vivas todavía).

## Decisiones de negocio

| Fecha | Decisión |
| --- | --- |
| 2026-11-17 | La carta se organiza en categorías definidas por el dueño, en el orden que él elija, y los platos tienen orden manual dentro de cada categoría. |
| 2026-11-17 | Un plato activo es un plato no archivado. Los platos archivados nunca aparecen en la carta, pero se conservan en el sistema porque los pedidos futuros los referenciarán. No existe el borrado de platos ni de categorías: solo el archivado. |
| 2026-11-17 | El dueño puede reactivar un plato o una categoría archivados (para que un archivado por error no sea irreversible). |
| 2026-11-17 | Una categoría archivada no se muestra al comensal, y tampoco sus platos, aunque estén activos. Una categoría sin platos activos tampoco se muestra. |
| 2026-11-17 | Cada plato tiene nombre, precio (euros, IVA incluido), descripción corta, foto opcional y declaración de alérgenos. Solo la foto es opcional. |
| 2026-11-17 | Se usan los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011, Anexo II. Se muestran siempre junto a cada plato del listado, como texto, sin interacción adicional. |
| 2026-11-17 | Cada plato declara sus alérgenos o declara explícitamente «sin alérgenos»; no se puede guardar un plato sin una de las dos declaraciones, ni con las dos a la vez. |
| 2026-11-17 | La carta es pública, se consulta sin identificarse y es la misma para todas las mesas; la identificación de mesa llega con el cambio de pedidos. |
| 2026-11-17 | Límite de tamaño de la foto de un plato: **5 MB** por archivo elegido por el dueño. |
| 2026-11-17 | Rendimiento: la carta carga en menos de 2 s en un móvil de gama media con 4G; las condiciones exactas de medición se fijan en design. |
| 2026-11-17 | Accesibilidad de la carta del comensal: WCAG 2.2 AA y, además, contraste de texto ≥ 7:1 y objetivos táctiles ≥ 44×44 CSS px (más exigente que AA, por la regla 4 de accesibilidad real). |
| 2026-11-17 | Interfaz en español (por defecto) e inglés. El contenido escrito por el dueño (nombres y descripciones de platos y categorías) no se traduce. |
| 2026-11-17 | La cuenta del dueño se da de alta al instalar cada local; no hay registro público de cuentas. |

## Fuera de alcance

- El pedido desde la mesa y la identificación de mesa (siguiente cambio).
- El panel de cocina / personal.
- La disponibilidad temporal de platos («agotado»).
- Precios por franjas horarias.
- La traducción del contenido escrito por el dueño.
- Cualquier cuenta o registro del comensal (prohibido por la regla 2, privacidad por diseño).

## Impact

- **Proyecto nuevo**: el repositorio aún no tiene código; este cambio arranca la SPA (React 19 + Vite + TypeScript + TanStack Query + SCSS) y el proyecto Supabase local (migraciones, RLS, Storage).
- **Supabase**: tablas de categorías y platos, tabla de usuarios de la zona privada, políticas RLS, bucket de fotos con límite de tamaño.
- **Acción manual por instancia**: aplicar migraciones, crear la cuenta del dueño y desactivar el registro público en Supabase Auth (detallado en design).
- **Dependencias**: las del stack declarado más las justificadas en design.
