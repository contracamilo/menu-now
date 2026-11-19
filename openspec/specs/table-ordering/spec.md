# table-ordering Specification

## Purpose

El pedido que hace el comensal desde la carta de su mesa: cómo lo compone (tamaño, cantidad y nota por línea), cómo lo revisa y confirma sin dar datos personales, qué ocurre si la carta cambia mientras decide, y cómo ve el número y el estado de cada pedido que hace.

## Requirements

### Requirement: Pedir solo desde la carta de una mesa activa
El comensal MUST poder pedir solo cuando ha abierto la carta desde el QR de una mesa activa. Si la abre desde la dirección general de la carta, desde el QR de una mesa archivada o desde un QR que no corresponde a ninguna mesa, la carta MUST mostrarse igualmente, sin ninguna opción para pedir y con un aviso de que para pedir debe escanear el QR de su mesa o consultar al personal.

#### Scenario: El comensal abre la carta desde el QR de su mesa
- **GIVEN** la mesa «Mesa 4» está activa
- **WHEN** el comensal escanea el QR de «Mesa 4»
- **THEN** ve la carta con la mesa «Mesa 4» indicada en la parte superior
- **AND** ve en cada plato con precio una acción para añadirlo al pedido

#### Scenario: El comensal abre la carta desde la dirección general
- **GIVEN** un comensal que abre la dirección general de la carta, sin mesa
- **WHEN** la carta se muestra
- **THEN** ve la carta completa sin ninguna acción para añadir platos
- **AND** ve un aviso de que para pedir debe escanear el QR de su mesa

#### Scenario: El comensal escanea el QR de una mesa archivada
- **GIVEN** la mesa «Terraza 2» está archivada
- **WHEN** el comensal escanea su QR
- **THEN** ve la carta completa sin ninguna acción para añadir platos
- **AND** ve un aviso de que desde esta mesa no se puede pedir y que consulte al personal

### Requirement: Añadir platos al pedido
Desde la carta de una mesa activa, el comensal MUST poder añadir al pedido cualquier plato activo que tenga precio. Para un plato con varios tamaños, MUST elegir el tamaño al añadirlo. Los platos de «Incluidos» MUST seguir mostrándose en la carta pero MUST NOT poder añadirse al pedido. La carta MUST mostrar en todo momento cuántas unidades lleva el pedido y su total, con acceso al resumen.

#### Scenario: El comensal añade un plato de un solo tamaño
- **GIVEN** el comensal está en la carta de la mesa «Mesa 4» con el pedido vacío
- **WHEN** añade «Caña», que cuesta 1,80 €
- **THEN** el pedido tiene una línea «Caña», cantidad 1
- **AND** la carta muestra que el pedido lleva 1 unidad y un total de 1,80 €

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

### Requirement: Líneas, cantidades y notas del pedido
Cada línea del pedido MUST corresponder a un plato, un tamaño y una nota. El comensal MUST poder cambiar la cantidad de cada línea entre 1 y 20, quitar una línea y escribir en cada línea una nota libre opcional de hasta 140 caracteres. Añadir de nuevo el mismo plato y tamaño MUST sumar una unidad a la línea sin nota de ese plato y tamaño, o crearla si no existe.

#### Scenario: El comensal añade una nota a un plato
- **GIVEN** el pedido tiene la línea «Bocadillo de lomo», cantidad 1
- **WHEN** el comensal escribe la nota «Sin cebolla» en esa línea
- **THEN** la línea muestra la nota «Sin cebolla»

#### Scenario: El comensal intenta escribir una nota de más de 140 caracteres
- **GIVEN** el comensal está escribiendo la nota de una línea
- **WHEN** intenta escribir más de 140 caracteres
- **THEN** el sistema no admite más de 140 caracteres
- **AND** le muestra cuántos caracteres lleva de los 140 permitidos

#### Scenario: El comensal pide el mismo plato con notas distintas
- **GIVEN** el pedido tiene la línea «Hamburguesa», cantidad 1, con la nota «Poco hecha»
- **WHEN** el comensal añade otra «Hamburguesa» y escribe en la nueva línea la nota «Muy hecha»
- **THEN** el pedido tiene dos líneas de «Hamburguesa», una con cada nota

#### Scenario: El comensal cambia la cantidad y quita una línea
- **GIVEN** el pedido tiene las líneas «Caña», cantidad 1, y «Croquetas · Ración», cantidad 1
- **WHEN** el comensal sube la cantidad de «Caña» a 3
- **AND** quita la línea «Croquetas · Ración»
- **THEN** el pedido tiene solo la línea «Caña», cantidad 3
- **AND** el comensal no puede bajar la cantidad de una línea de 1 ni subirla de 20

### Requirement: Resumen y total antes de confirmar
Antes de enviar el pedido, el sistema MUST mostrar al comensal un resumen con la mesa, cada línea (plato, tamaño si tiene nombre, cantidad, nota e importe) y el total en euros con IVA incluido. El comensal MUST poder volver a la carta para seguir añadiendo platos sin perder lo que lleva. Un pedido sin líneas MUST NOT poder confirmarse.

#### Scenario: El comensal revisa su pedido
- **GIVEN** el comensal de la mesa «Mesa 4» ha añadido 2 «Caña» a 1,80 € y 1 «Croquetas · Ración» a 7,00 € con la nota «Bien calientes»
- **WHEN** abre el resumen del pedido
- **THEN** ve la mesa «Mesa 4», la línea «Caña» × 2 por 3,60 €, la línea «Croquetas · Ración» × 1 por 7,00 € con la nota «Bien calientes»
- **AND** ve el total de 10,60 € con IVA incluido y la acción para confirmar el pedido

#### Scenario: El comensal intenta confirmar un pedido vacío
- **GIVEN** el comensal ha quitado todas las líneas de su pedido
- **WHEN** abre el resumen
- **THEN** ve que el pedido está vacío
- **AND** no tiene ninguna acción para confirmarlo

### Requirement: Confirmación sin datos personales
El comensal MUST poder confirmar su pedido sin iniciar sesión, sin crear cuenta y sin introducir correo, teléfono, nombre ni ningún otro dato personal. Un pedido confirmado MUST pertenecer a la mesa desde la que se hizo y MUST NOT asociarse a ninguna persona. Confirmar varias veces seguidas el mismo pedido por error MUST NOT crear más de un pedido.

#### Scenario: El comensal confirma su pedido
- **GIVEN** el comensal de la mesa «Mesa 4» está en el resumen de su pedido
- **WHEN** confirma el pedido
- **THEN** el sistema registra el pedido para la mesa «Mesa 4» sin pedirle ningún dato
- **AND** el pedido queda disponible para cocina con el estado «Recibido»

#### Scenario: El comensal pulsa confirmar dos veces
- **GIVEN** el comensal está en el resumen de su pedido
- **WHEN** pulsa confirmar dos veces seguidas
- **THEN** el sistema registra un único pedido

#### Scenario: El comensal confirma sin conexión
- **GIVEN** el móvil del comensal no consigue enviar el pedido
- **WHEN** el comensal confirma el pedido
- **THEN** ve un mensaje que indica que el pedido no se ha enviado y una acción para reintentar
- **AND** conserva todas las líneas de su pedido
- **WHEN** recupera la conexión y reintenta
- **THEN** el sistema registra un único pedido

### Requirement: Platos que dejan de estar disponibles antes de confirmar
Si al confirmar el pedido alguna línea corresponde a un plato que ya no está en la carta o a un tamaño que ya no existe, el sistema MUST NOT registrar el pedido, MUST indicar al comensal qué platos ya no están disponibles, MUST retirarlos del pedido y MUST mostrarle de nuevo el resumen actualizado para que vuelva a confirmar.

#### Scenario: Un plato se archiva mientras el comensal decide
- **GIVEN** el comensal ha añadido «Croquetas · Ración» y «Caña» a su pedido
- **AND** el dueño archiva «Croquetas» antes de que el comensal confirme
- **WHEN** el comensal confirma el pedido
- **THEN** el sistema no registra el pedido
- **AND** le indica que «Croquetas» ya no está disponible y lo retira del pedido
- **AND** le muestra el resumen con solo «Caña» y el total actualizado
- **WHEN** el comensal vuelve a confirmar
- **THEN** el sistema registra el pedido con solo «Caña»

#### Scenario: Todos los platos del pedido dejan de estar disponibles
- **GIVEN** el pedido del comensal solo tiene «Flan»
- **AND** el dueño archiva la categoría «Postres», a la que pertenece «Flan», antes de que el comensal confirme
- **WHEN** el comensal confirma el pedido
- **THEN** el sistema no registra el pedido
- **AND** le indica que «Flan» ya no está disponible y que su pedido ha quedado vacío

### Requirement: Precios que cambian antes de confirmar
Si al confirmar el pedido el precio de alguna línea es distinto del que el comensal ha visto en el resumen, el sistema MUST NOT registrar el pedido, MUST indicarle qué precios han cambiado y MUST mostrarle el resumen con los precios y el total actualizados para que vuelva a confirmar.

#### Scenario: El dueño cambia un precio mientras el comensal decide
- **GIVEN** el comensal ve en su resumen «Caña» × 2 a 1,80 € y un total de 3,60 €
- **AND** el dueño cambia el precio de «Caña» a 2,00 € antes de que el comensal confirme
- **WHEN** el comensal confirma el pedido
- **THEN** el sistema no registra el pedido
- **AND** le indica que el precio de «Caña» ha cambiado y le muestra el nuevo total de 4,00 €
- **WHEN** el comensal vuelve a confirmar
- **THEN** el sistema registra el pedido con un total de 4,00 €

### Requirement: Pedido desde una mesa archivada antes de confirmar
Si la mesa se archiva mientras el comensal compone el pedido, el sistema MUST NOT registrar el pedido al confirmarlo y MUST indicar al comensal que desde esta mesa ya no se puede pedir y que consulte al personal.

#### Scenario: El dueño archiva la mesa mientras el comensal decide
- **GIVEN** el comensal de la mesa «Terraza 2» tiene platos en su pedido
- **AND** el dueño archiva «Terraza 2» antes de que el comensal confirme
- **WHEN** el comensal confirma el pedido
- **THEN** el sistema no registra el pedido
- **AND** le indica que desde esta mesa ya no se puede pedir y que consulte al personal

### Requirement: Número y estado del pedido
Tras registrar un pedido, el sistema MUST mostrar al comensal una confirmación con el número del pedido, la mesa, sus líneas, el total y su estado. Los números de pedido MUST ser correlativos dentro de cada día, empezando por 1. El estado de un pedido recién registrado MUST ser «Recibido».

#### Scenario: El comensal ve la confirmación de su pedido
- **GIVEN** es el tercer pedido del día en el local
- **WHEN** el comensal de la mesa «Mesa 4» confirma su pedido
- **THEN** ve una confirmación con el número de pedido 3, la mesa «Mesa 4», sus líneas, el total y el estado «Recibido»

#### Scenario: La numeración empieza de nuevo cada día
- **GIVEN** ayer se registraron 57 pedidos
- **WHEN** un comensal confirma el primer pedido de hoy
- **THEN** ve el número de pedido 1

### Requirement: Varios pedidos por mesa
Una mesa MUST admitir varios pedidos durante el servicio; cada confirmación MUST registrarse como un pedido independiente con su propio número. Tras confirmar, el comensal MUST poder volver a la carta con el pedido vacío para hacer otro.

#### Scenario: La mesa pide el postre después
- **GIVEN** el comensal de la mesa «Mesa 4» confirmó el pedido número 3 con dos platos principales
- **WHEN** vuelve a la carta, añade «Flan» y confirma
- **THEN** el sistema registra un nuevo pedido con otro número solo con «Flan»
- **AND** el pedido número 3 no cambia

#### Scenario: Dos comensales de la misma mesa piden desde sus móviles
- **GIVEN** dos comensales de la mesa «Mesa 4» han abierto la carta desde el mismo QR, cada uno en su móvil
- **WHEN** cada uno confirma su propio pedido
- **THEN** el sistema registra dos pedidos independientes para la mesa «Mesa 4», cada uno con su número

### Requirement: Pedidos hechos desde el móvil
El comensal MUST poder volver a ver, desde la carta de su mesa, el número, las líneas, el total y el estado de los pedidos que ha confirmado desde ese móvil para esa mesa durante el día, sin identificarse. El comensal MUST NOT ver pedidos hechos desde otros móviles.

#### Scenario: El comensal consulta sus pedidos
- **GIVEN** el comensal confirmó desde su móvil los pedidos 3 y 8 en la mesa «Mesa 4»
- **WHEN** abre «Mis pedidos» desde la carta de «Mesa 4»
- **THEN** ve los pedidos 3 y 8 con sus líneas, su total y su estado

#### Scenario: El comensal no ve los pedidos de otro móvil
- **GIVEN** otro comensal de la mesa «Mesa 4» confirmó el pedido 5 desde su móvil
- **WHEN** el primer comensal abre «Mis pedidos» desde su propio móvil
- **THEN** no ve el pedido 5

### Requirement: Pedido sin confirmar conservado en el móvil
Mientras el comensal no confirma el pedido, el sistema MUST conservarlo en ese móvil si el comensal recarga la carta o la vuelve a abrir desde el QR de la misma mesa.

#### Scenario: El comensal recarga la carta con platos en el pedido
- **GIVEN** el comensal de la mesa «Mesa 4» ha añadido 2 «Caña» con la nota «Muy frías» y no ha confirmado
- **WHEN** recarga la carta
- **THEN** su pedido sigue teniendo 2 «Caña» con la nota «Muy frías»

### Requirement: El pedido conserva lo que se pidió
Un pedido registrado MUST conservar, para cada línea, el nombre del plato, el nombre del tamaño, el precio unitario, la cantidad y la nota tal como estaban al confirmarse, aunque el dueño edite, archive o cambie el precio del plato después.

#### Scenario: El dueño cambia un plato después de pedirlo
- **GIVEN** el comensal confirmó el pedido número 3 con «Croquetas · Ración» a 7,00 €
- **WHEN** el dueño cambia el precio de la ración a 8,00 € y renombra el plato a «Croquetas caseras»
- **AND** el comensal vuelve a ver el pedido número 3 en «Mis pedidos»
- **THEN** ve «Croquetas · Ración» a 7,00 € y el mismo total que confirmó

### Requirement: Accesibilidad del pedido
Las pantallas del pedido (añadir, elegir tamaño, resumen, confirmación y «Mis pedidos») MUST cumplir los mismos criterios que la carta: WCAG 2.2 nivel AA, contraste de texto de al menos 7:1 y objetivos táctiles de al menos 44×44 CSS px. Los cambios en el pedido (añadir, quitar, cambiar cantidad, platos retirados) MUST anunciarse a los lectores de pantalla.

#### Scenario: El comensal pide con lector de pantalla
- **GIVEN** un comensal que usa un lector de pantalla en la carta de su mesa
- **WHEN** añade «Caña» al pedido
- **THEN** el lector anuncia que se ha añadido «Caña» y el nuevo total del pedido
- **AND** cada botón de añadir, de cambiar cantidad y de quitar se anuncia con el nombre del plato al que afecta

#### Scenario: El comensal pide a pleno sol
- **GIVEN** un comensal que compone su pedido en el móvil
- **WHEN** lee cualquier texto o toca cualquier control de las pantallas del pedido
- **THEN** todo texto tiene un contraste de al menos 7:1 con su fondo
- **AND** todo control tiene un área táctil de al menos 44×44 CSS px

### Requirement: Estado actual del pedido visto por el comensal
La confirmación de un pedido y «Mis pedidos» MUST mostrar al comensal el estado actual de cada pedido: «Recibido», «En preparación», «Servido» o «Cancelado». El estado MUST estar actualizado cada vez que el comensal abre esas pantallas o vuelve a ellas, sin que tenga que identificarse.

#### Scenario: El comensal comprueba si su pedido está en marcha
- **GIVEN** el comensal de «Mesa 4» confirmó el pedido 3 desde su móvil
- **AND** el personal ha pasado el pedido 3 a «En preparación»
- **WHEN** el comensal vuelve a «Mis pedidos» desde la carta de «Mesa 4»
- **THEN** ve el pedido 3 con el estado «En preparación»

#### Scenario: El comensal ve que su pedido se ha cancelado
- **GIVEN** el comensal de «Mesa 4» confirmó el pedido 8 desde su móvil
- **AND** el personal ha cancelado el pedido 8
- **WHEN** el comensal abre el detalle del pedido 8
- **THEN** ve el pedido 8 con el estado «Cancelado»
- **AND** ve un texto que le invita a preguntar al personal si tiene dudas
