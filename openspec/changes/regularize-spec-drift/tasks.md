# Tasks: regularize-spec-drift

## 1. Límite de 50 líneas por pedido (D-03, design D1)

- [ ] 1.1 Añadir `MAX_LINES = 50` y `wouldExceedLines` en `src/features/order/orderReducer.ts`; la acción `add` no crea la línea 51 y sigue sumando unidades a una línea existente. Verificar con tests en `orderReducer.test.ts` titulados con [table-ordering] «El comensal llega al máximo de líneas» y «Sumar unidades a una línea existente con 50 líneas».
- [ ] 1.2 Añadir `order.maxLines` en `src/i18n/es.ts` y `en.ts`. `AddToOrder` anuncia `order.maxLines` en lugar de «añadido» al llegar al límite, y `OrderBar` (`TableMenuPage.tsx`) muestra el aviso visible mientras el pedido tiene 50 líneas. Verificar con un test en `TableMenuPage.test.tsx` titulado con [table-ordering] «El comensal llega al máximo de líneas» (el aviso se ve y se anuncia) y con `i18n.test.tsx` en verde.

## 2. Textos del comensal (D-10, D-11, design D2)

- [ ] 2.1 Cambiar `table.scanToOrder` en es/en para añadir «o pregunta al personal», y actualizar los tests y e2e que buscan el texto exacto. Verificar con los tests de `TableMenuPage.test.tsx` y `MenuPage.test.tsx` [table-ordering] «El comensal abre la carta desde la dirección general» y el caso del QR desconocido.
- [ ] 2.2 Cambiar `order.receivedHelp` y añadir `order.preparingHelp` en es/en; `OrderDetailPage` elige el texto según el estado. Verificar con tests en `OrderDetailPage.test.tsx`: «Recibido» no dice «preparando», «En preparación» sí, y [table-ordering] «El comensal ve que su pedido se ha cancelado» sigue en verde.

## 3. Catálogo, mesas y local (D-02, D-04)

- [ ] 3.1 Cambiar `error.price` en es/en para que mencione el máximo de 99 999,99 €. Verificar con un test en `DishForm.test.tsx` titulado con [catalog-management] «El dueño escribe un precio demasiado alto» (no se guarda y muestra el error) y con `money.test.ts` (100000 → `error.price`).
- [ ] 3.2 Renombrar o ampliar los tests de límites para que nombren los escenarios: `DishForm.test.tsx` [catalog-management] «El dueño escribe una descripción larga»; `TableForm.test.tsx` [table-management] «El dueño escribe un nombre de mesa largo»; `VenuePage.test.tsx` [venue-settings] «El dueño escribe un nombre de local largo». Verificar que los tres pasan.
- [ ] 3.3 Añadir en `supabase/tests/02_categories.test.sql` un caso [catalog-management] «Intento de guardar un nombre demasiado largo fuera de la interfaz» (41 caracteres → violación del check), y renombrar el test de `CatalogPage.test.tsx` («un nombre ya usado al reactivar…») a [catalog-management] «El dueño intenta reactivar una categoría con nombre repetido». Verificar con `npm run db:test` sobre ese fichero y con el test de `CatalogPage`.

## 4. Día de servicio y panel de cocina (D-01, D-06, design D3)

- [ ] 4.1 Añadir en `supabase/tests/06_place_order.test.sql` (o en un fichero nuevo `09_service_day.test.sql`) los casos [table-ordering] «Un pedido de madrugada sigue la numeración de la noche» y «El día de servicio empieza a las 05:00», fijando la zona `Etc/GMT±N` dentro de la transacción. Añadir en `08_kitchen_panel.test.sql` el caso [kitchen-panel] «Los pedidos de madrugada siguen en el panel». Verificar con `npm run db:test`.
- [ ] 4.2 Renombrar o ampliar los tests de `KitchenAlerts.test.tsx` y `useKitchenRealtime.test.tsx` para que nombren [kitchen-panel] «La tablet no se apaga durante el servicio», «Un navegador que no permite mantener la pantalla encendida», «El personal activa el sonido al abrir el panel», «El resaltado desaparece al empezar el pedido» y «El resaltado desaparece a los 2 minutos». Verificar que los cinco pasan.

## 5. Acceso del personal, carta y «Mis pedidos» (D-05, D-07, D-08, D-09)

- [ ] 5.1 Añadir en `supabase/tests/08_kitchen_panel.test.sql` el caso [backoffice-access] «El personal lee las mesas fuera de la interfaz» (lee nombre, estado y token de una mesa activa y de una archivada; no puede actualizarlas). Verificar con `npm run db:test`.
- [ ] 5.2 Añadir en `BackToTop.test.tsx` el caso [menu] «El comensal baja menos de una pantalla» y en `TableMenuPage.test.tsx` el caso [table-ordering] «El comensal con el pedido vacío no ve la barra del pedido». Actualizar el test de `MyOrdersPage.test.tsx` [table-ordering] «El comensal consulta sus pedidos» para que compruebe la hora, el total y el estado en la lista y las líneas en el detalle. Verificar que los tres pasan.
- [ ] 5.3 Añadir un test que nombre [table-ordering] «El comensal pide a pleno sol» (D-14): los controles de las pantallas del pedido usan `tap-target` y los tokens de color de esas pantallas pasan el contraste de 7:1 en `contrast.test.ts`. Verificar que pasa.

## 6. Mantenimiento documental (D-12, D-13, design D4)

- [ ] 6.1 Actualizar el «Purpose» de `openspec/specs/backoffice-access/spec.md` (zona privada para dueños y personal) y de `openspec/specs/venue-settings/spec.md` (sin «en este cambio»). Verificar con `openspec validate --specs --strict`.
- [ ] 6.2 Corregir la ruta del design en los comentarios de cabecera de `supabase/migrations/20261120000000_pedidos_mesa.sql` y `20261121000100_panel_cocina.sql` para que apunten a `openspec/changes/archive/2026-11-19-…`. Verificar con `grep -n "openspec/changes/add-" supabase/migrations` sin resultados.

## 7. Verificación final

- [ ] 7.1 Ejecutar `npm run typecheck`, `npm test`, `npm run db:test`, `npm run test:int` y `npm run e2e`, todos en verde, y `openspec validate regularize-spec-drift --strict`.
- [ ] 7.2 Repetir `/spec-audit` y confirmar que D-01 a D-14 ya no aparecen.

## Workflow follow-up

- Archivar el cambio (`openspec archive regularize-spec-drift`) tras la revisión del PR.
