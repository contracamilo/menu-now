# Revisión de accesibilidad y uso en móvil (add-carta-digital)

Registro de las revisiones de las tareas 7.6 (administración) y 8.2 (carta del comensal).
Requisitos: `[catalog-management] «El dueño gestiona el catálogo desde su móvil»` y
`[menu] «El comensal lee y toca la carta a pleno sol»` (design D10).

## Comprobaciones automáticas

| Comprobación | Herramienta | Resultado |
| --- | --- | --- |
| Contraste ≥ 7:1 de todos los pares texto/fondo de los tokens | `src/styles/contrast.test.ts` | ✅ |
| Todos los botones y enlaces de catálogo y formulario de plato usan `tap-target` | `CatalogPage.test.tsx`, `DishForm.test.tsx` | ✅ |
| Auditoría Lighthouse de accesibilidad de la carta (axe, incluye contraste AA y `target-size`) | `npm run perf` | ✅ puntuación 1 |
| Sin desplazamiento horizontal y controles ≥ 44×44 CSS px a 360 px de ancho | Playwright (viewport 360×740, DPR 2, táctil), build de producción contra Supabase local con el seed | ✅ ver tabla |

### Medición a 360 px (2026-11-19, tras el estilo suave, el carrusel y «Volver arriba»)

| Pantalla | Desbordamiento horizontal | Controles medidos | Controles < 44×44 px | Errores de consola |
| --- | --- | --- | --- | --- |
| `/` (carta, arriba: índice con flecha) | 0 px | 12 | 0 | 0 |
| `/` (carta, abajo: «Volver arriba») | 0 px | 13 | 0 | 0 |
| `/admin/login` | 0 px | 6 | 0 | 0 |
| `/admin/forgot-password` | 0 px | 5 | 0 | 0 |
| `/admin/reset-password` (enlace no válido) | 0 px | 3 | 0 | 0 |
| `/admin` (catálogo de referencia completo) | 0 px | 310 | 0 | 0 |
| `/admin/venue` | 0 px | 10 | 0 | 0 |
| `/admin/categories/new` | 0 px | 9 | 0 | 0 |
| `/admin/dishes/new` | 0 px | 29 | 0 | 0 |
| `/admin/dishes/:id` (Croquetas, 3 tamaños) | 0 px | 42 | 0 | 0 |

Se miden botones (incluidas las flechas del índice y «Volver arriba»), enlaces, `select`, campos de texto, casillas (su `label`) y el botón de elegir imagen.

## Revisión manual pendiente

Estas comprobaciones necesitan un móvil real y un lector de pantalla; no se pueden automatizar.
Marca cada punto al completarlo e indica dispositivo, sistema y fecha.

### 7.6 Administración (TalkBack / VoiceOver)

Dispositivo / lector / fecha: _pendiente_

- [ ] Iniciar sesión, restablecer contraseña (pedir enlace y crear contraseña nueva) con el lector de pantalla.
- [ ] Catálogo: cada categoría se anuncia como encabezado; «Subir X» / «Bajar X», «Editar X», «Archivar X» se anuncian con el nombre del elemento.
- [ ] Crear, editar, archivar, reactivar y reordenar un plato y una categoría solo con el lector.
- [ ] Formulario de plato: los errores (nombre, precio, tamaños, alérgenos, «incluido con») se anuncian al guardar.
- [ ] «Mi local»: elegir, cambiar y quitar el logo; el error de imagen de más de 5 MB se anuncia.
- [ ] Todo lo anterior a 360 px sin desplazamiento horizontal en el móvil real.

### 8.2 Carta del comensal (a pleno sol y con lector de pantalla)

Dispositivo / lector / fecha: _pendiente_

- [ ] Contraste ≥ 7:1 legible en pantalla real a pleno sol (brillo automático).
- [ ] Objetivos táctiles ≥ 44×44 px medidos en DevTools (selector de idioma, enlaces y flechas del índice, «Volver arriba», «Reintentar»).
- [ ] El índice en carrusel se desliza bien con el dedo y las flechas se entienden; «Volver arriba» no tapa contenido importante.
- [ ] El índice y el aviso de alergias se leen bien a 360 px.
- [ ] Con lector: el índice se anuncia como navegación, cada categoría como encabezado y cada plato con nombre, tamaños y precios (o «incluido con»), descripción y alérgenos.
