# Proposal: add-pedidos-mesa

## Why

Hoy el comensal consulta la carta desde el QR de su mesa, pero para pedir tiene que esperar a que alguien del personal se acerque. En las horas punta eso significa esperas, comandas apuntadas a mano y errores («¿era sin cebolla?»). Con la carta digital ya en marcha (`menu`, `catalog-management`), el siguiente paso natural es que el comensal pida desde su móvil, sin identificarse, y que el pedido quede registrado para cocina con su mesa, sus platos, sus tamaños y sus notas.

## Roles afectados

- **Comensal (diner)**: abre la carta con su mesa ya identificada, compone un pedido (platos, tamaño, cantidad, nota por plato), revisa el resumen con el total, lo confirma sin dar ningún dato personal y ve en su móvil el número y el estado de sus pedidos.
- **Dueño (owner)**: da de alta, renombra, archiva y reactiva las mesas del local desde la administración, y obtiene el QR único de cada mesa para imprimirlo.
- **Personal (staff)**: sin pantallas en este cambio. Los pedidos confirmados quedan registrados con el estado «recibido», listos para el futuro panel de cocina (`panel-cocina`), que será quien los muestre y cambie su estado.

## What Changes

- Nuevas **mesas** gestionadas por el dueño en la administración: nombre visible (p. ej. «Mesa 4», «Terraza 2»), alta, cambio de nombre, archivado y reactivación, y un QR único por mesa que abre la carta con esa mesa identificada. Cambiar el nombre no cambia el QR.
- La **carta** se puede abrir desde el QR de una mesa (con la mesa identificada y visible) o desde su dirección general (solo consulta, sin poder pedir). El contenido de la carta sigue siendo el mismo para todas las mesas.
- Nuevo **pedido desde la mesa** para el comensal:
  - añadir platos de la carta eligiendo tamaño (si el plato tiene varios), con cantidad y una nota libre opcional de hasta 140 caracteres por línea;
  - los platos de «Incluidos» se siguen viendo, pero no se pueden añadir al pedido;
  - resumen con cada línea, su importe y el total en euros (IVA incluido) antes de confirmar;
  - confirmación sin registro ni dato personal alguno;
  - si al confirmar algún plato ya no está en la carta (o su tamaño ya no existe), el sistema lo indica, lo retira y no envía nada hasta que el comensal vuelva a confirmar; si algún precio ha cambiado, muestra el total actualizado y pide confirmar de nuevo;
  - tras confirmar, pantalla con el número de pedido y su estado; la mesa puede hacer tantos pedidos independientes como quiera durante el servicio.
- Cada pedido conserva el nombre del plato, el tamaño y el precio que tenía al confirmarse, aunque el dueño edite o archive después el plato.

## Capabilities

### New Capabilities

- `table-management`: las mesas del local que gestiona el dueño — alta, nombre, archivado, reactivación y el QR único de cada mesa.
- `table-ordering`: el pedido que hace el comensal desde la carta de su mesa — composición (tamaño, cantidad, nota), resumen y total, confirmación anónima, platos que dejan de estar disponibles, número y estado del pedido, varios pedidos por mesa.

### Modified Capabilities

- `menu`: el requisito «Carta pública sin identificación» pasa a distinguir la carta abierta desde el QR de una mesa (con la mesa identificada) de la carta abierta desde la dirección general (solo consulta), manteniendo la misma carta para todas las mesas y sin pedir ningún dato al comensal.

## Decisiones de negocio

| Fecha | Decisión |
| --- | --- |
| 2026-11-19 | Cada mesa tiene un **código QR único e impreso** que abre la carta con la mesa ya identificada. Un pedido pertenece a una mesa, nunca a una persona (regla 2, privacidad por diseño). |
| 2026-11-19 | Las mesas las da de alta y gestiona **el dueño desde la administración** (crear, renombrar, archivar, reactivar) y desde ahí obtiene el QR de cada una para imprimirlo. Las mesas no se borran, solo se archivan (los pedidos las referencian). |
| 2026-11-19 | Cambiar el nombre de una mesa **no cambia su QR**: el QR impreso sigue sirviendo. El QR de una mesa archivada abre la carta en modo consulta, sin poder pedir. |
| 2026-11-19 | El comensal añade platos al pedido, indica la **cantidad** y puede añadir una **nota libre por plato** («sin cebolla», «poco hecho») de **hasta 140 caracteres**. |
| 2026-11-19 | Para un plato con varios tamaños, el comensal **elige el tamaño** al añadirlo; cada combinación de plato, tamaño y nota es una línea del pedido. |
| 2026-11-19 | La cantidad de cada línea va de **1 a 20** unidades (para más, se habla con el personal o se hace otro pedido). |
| 2026-11-19 | Los platos de **«Incluidos» no se pueden pedir**: siguen visibles en la carta y el personal los sirve como hasta ahora con la compra correspondiente. |
| 2026-11-19 | Antes de enviar, el comensal ve un **resumen con el total en euros** y lo confirma. La confirmación **no requiere registro, correo, teléfono ni ningún dato personal**. |
| 2026-11-19 | Un pedido confirmado llega a cocina (el panel `panel-cocina` llegará en un cambio posterior) y el comensal ve en su móvil una **confirmación con número de pedido y estado**. En este cambio el único estado es «Recibido»; los demás estados los introducirá `panel-cocina`. |
| 2026-11-19 | El número de pedido es **corto y correlativo dentro del día** (empieza en 1 cada día) para que el personal lo pueda decir en voz alta. |
| 2026-11-19 | Una mesa puede tener **varios pedidos abiertos** durante el servicio (se pide dos veces, se pide el postre después); cada confirmación es un **pedido independiente**. |
| 2026-11-19 | El comensal ve en su móvil **los pedidos que ha hecho desde ese dispositivo para esa mesa durante el día**; no ve los pedidos hechos desde otros móviles de la misma mesa. |
| 2026-11-19 | Si un plato **deja de estar en la carta** (archivado, o su categoría archivada) o su tamaño deja de existir entre que el comensal lo añadió y la confirmación, el sistema se lo indica y **lo retira del pedido antes de enviar**; el comensal revisa el resumen y vuelve a confirmar. |
| 2026-11-19 | Si el **precio** de algún plato del pedido ha cambiado antes de confirmar, el sistema muestra el resumen con el precio y el total actualizados y pide confirmar de nuevo: nunca se envía un pedido con un total distinto del que el comensal ha visto. |
| 2026-11-19 | El pedido **conserva el nombre del plato, el tamaño y el precio** que tenía al confirmarse, aunque el dueño edite o archive después el plato (resuelve la entrega pendiente de `add-carta-digital`). |
| 2026-11-19 | El pedido en preparación (aún sin confirmar) **se conserva en ese móvil** si el comensal recarga o vuelve a abrir la carta de la misma mesa. |
| 2026-11-19 | El comensal **no puede modificar ni cancelar** un pedido ya confirmado desde la app: debe hablar con el personal. |

## Fuera de alcance

- Pago online (se paga en caja, como siempre) y cualquier pasarela de pago.
- Propinas.
- Dividir la cuenta.
- Llamar al camarero.
- Pedidos para llevar.
- El panel de cocina / personal y los cambios de estado del pedido (`panel-cocina`).
- Modificar o cancelar un pedido confirmado desde la app.
- Ver la cuenta acumulada de la mesa.
- Avisos en tiempo real al comensal.
- Regenerar el QR de una mesa (si se pierde o se copia, ver Open Questions de design).

## Impact

- **Supabase**: nueva migración con las tablas de mesas y pedidos (pedido y líneas con copia de nombre, tamaño y precio), sus políticas RLS y una función para confirmar el pedido de forma anónima validando mesa, platos, tamaños y precios en servidor. Las tablas existentes no cambian de forma incompatible.
- **SPA**: nueva ruta de carta por mesa; botón para añadir en cada plato con precio; pantallas de pedido, resumen y confirmación; pantalla «Mesas» en la administración con el QR imprimible. Las peticiones tempranas de la carta se extienden a la ruta por mesa para seguir cumpliendo el presupuesto de rendimiento.
- **Acción manual por instancia**: aplicar la nueva migración; el dueño da de alta las mesas, imprime sus QR y sustituye los QR genéricos actuales (que pasan a abrir la carta en modo consulta).
- **Dependencias**: posiblemente una librería pequeña para generar QR en la administración (justificación en design).
