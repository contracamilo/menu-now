## ADDED Requirements

### Requirement: Día de servicio
El «día» de los pedidos (su numeración, «Mis pedidos» y el panel de cocina) MUST ser el día de servicio: la fecha local del local, que cambia a las 05:00 hora local, no a medianoche.

#### Scenario: Un pedido de madrugada sigue la numeración de la noche
- **GIVEN** el día de servicio que empezó ayer a las 05:00 lleva 40 pedidos
- **WHEN** un comensal confirma un pedido hoy a las 02:00
- **THEN** ve el número de pedido 41

#### Scenario: El día de servicio empieza a las 05:00
- **GIVEN** el último pedido se confirmó hoy a las 02:00 con el número 41
- **WHEN** un comensal confirma un pedido hoy a las 05:10
- **THEN** ve el número de pedido 1

### Requirement: Máximo de líneas por pedido
Un pedido MUST tener como máximo 50 líneas. Cuando el pedido ya tiene 50 líneas, la carta MUST NOT añadir una línea nueva y MUST indicar al comensal que ha llegado al máximo de líneas y que puede confirmar este pedido y hacer otro.

#### Scenario: El comensal llega al máximo de líneas
- **GIVEN** el pedido del comensal de la mesa «Mesa 4» tiene 50 líneas
- **WHEN** el comensal intenta añadir un plato que crearía una línea nueva
- **THEN** el pedido sigue teniendo 50 líneas
- **AND** el comensal ve que ha llegado al máximo de líneas y que puede confirmar este pedido y hacer otro

#### Scenario: Sumar unidades a una línea existente con 50 líneas
- **GIVEN** el pedido tiene 50 líneas, una de ellas «Caña», cantidad 1, sin nota
- **WHEN** el comensal añade otra «Caña»
- **THEN** la línea «Caña» pasa a cantidad 2 y el pedido sigue teniendo 50 líneas

## MODIFIED Requirements

### Requirement: Añadir platos al pedido
Desde la carta de una mesa activa, el comensal MUST poder añadir al pedido cualquier plato activo que tenga precio. Para un plato con varios tamaños, MUST elegir el tamaño al añadirlo. Los platos de «Incluidos» MUST seguir mostrándose en la carta pero MUST NOT poder añadirse al pedido. Mientras el pedido tenga al menos una línea, la carta MUST mostrar en todo momento cuántas unidades lleva el pedido y su total, con acceso al resumen.

#### Scenario: El comensal añade un plato de un solo tamaño
- **GIVEN** el comensal está en la carta de la mesa «Mesa 4» con el pedido vacío
- **WHEN** añade «Caña», que cuesta 1,80 €
- **THEN** el pedido tiene una línea «Caña», cantidad 1
- **AND** la carta muestra que el pedido lleva 1 unidad y un total de 1,80 €

#### Scenario: El comensal con el pedido vacío no ve la barra del pedido
- **GIVEN** el comensal está en la carta de la mesa «Mesa 4» con el pedido vacío
- **WHEN** mira la carta
- **THEN** no ve las unidades ni el total del pedido ni el acceso al resumen

#### Scenario: El comensal elige el tamaño de un plato con varios tamaños
- **GIVEN** el plato «Croquetas» tiene los tamaños «Una» a 1,50 €, «Ración» a 7,00 € y «Plato» a 12,00 €
- **WHEN** el comensal elige añadir «Croquetas»
- **THEN** el sistema le pide elegir uno de los tres tamaños, con su precio
- **WHEN** elige «Ración»
- **THEN** el pedido tiene una línea «Croquetas · Ración» a 7,00 €

#### Scenario: El comensal no puede pedir un plato incluido
- **GIVEN** el plato «Tapa del día» está en «Incluidos» con el texto «Con cada bebida»
- **WHEN** el comensal está en la carta de una mesa activa
- **THEN** ve «Tapa del día» con el texto «Con cada bebida»
- **AND** no ve ninguna acción para añadirlo al pedido

### Requirement: Número y estado del pedido
Tras registrar un pedido, el sistema MUST mostrar al comensal una confirmación con el número del pedido, la mesa, sus líneas, el total y su estado. Los números de pedido MUST ser correlativos dentro de cada día de servicio, empezando por 1. El estado de un pedido recién registrado MUST ser «Recibido».

#### Scenario: El comensal ve la confirmación de su pedido
- **GIVEN** es el tercer pedido del día de servicio en el local
- **WHEN** el comensal de la mesa «Mesa 4» confirma su pedido
- **THEN** ve una confirmación con el número de pedido 3, la mesa «Mesa 4», sus líneas, el total y el estado «Recibido»

#### Scenario: La numeración empieza de nuevo cada día
- **GIVEN** en el día de servicio anterior se registraron 57 pedidos
- **WHEN** un comensal confirma el primer pedido del día de servicio actual
- **THEN** ve el número de pedido 1

### Requirement: Pedidos hechos desde el móvil
El comensal MUST poder volver a ver, desde la carta de su mesa, los pedidos que ha confirmado desde ese móvil para esa mesa durante el día de servicio, sin identificarse. «Mis pedidos» MUST mostrar el número, la hora, el total y el estado de cada pedido, y al abrir uno MUST mostrar también sus líneas. El comensal MUST NOT ver pedidos hechos desde otros móviles.

#### Scenario: El comensal consulta sus pedidos
- **GIVEN** el comensal confirmó desde su móvil los pedidos 3 y 8 en la mesa «Mesa 4»
- **WHEN** abre «Mis pedidos» desde la carta de «Mesa 4»
- **THEN** ve los pedidos 3 y 8 con su hora, su total y su estado
- **WHEN** abre el pedido 3
- **THEN** ve sus líneas, su total y su estado

#### Scenario: El comensal no ve los pedidos de otro móvil
- **GIVEN** otro comensal de la mesa «Mesa 4» confirmó el pedido 5 desde su móvil
- **WHEN** el primer comensal abre «Mis pedidos» desde su propio móvil
- **THEN** no ve el pedido 5
