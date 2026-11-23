# kitchen-panel Specification

## Purpose

El panel con el que el personal (y el dueño) recibe y gestiona los pedidos del día desde una tablet: qué pedidos ve y en qué orden, cómo le llegan los pedidos nuevos sin recargar, el ciclo de estados de cada pedido, la cancelación y el histórico del día.

## Requirements

### Requirement: Acceso al panel de cocina
El sistema MUST exigir una sesión iniciada con una cuenta de personal o de dueño para ver o usar el panel de cocina y su histórico. El sistema MUST rechazar cualquier lectura de pedidos o cambio de estado de un pedido que no proceda de una de esas sesiones, aunque se intente sin pasar por la interfaz.

#### Scenario: Acceso al panel sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** abre la dirección del panel de cocina
- **THEN** el sistema no muestra ningún pedido
- **AND** le muestra la pantalla de inicio de sesión

#### Scenario: El dueño abre el panel de cocina
- **GIVEN** el dueño ha iniciado sesión en la administración
- **WHEN** elige «Cocina» en la navegación de la administración
- **THEN** ve el panel de cocina con los pedidos del día y puede cambiar su estado

#### Scenario: Intento de cambiar un pedido sin sesión de personal ni de dueño
- **GIVEN** una persona sin sesión, o un comensal desde la carta de su mesa
- **WHEN** intenta leer los pedidos del local o cambiar el estado de un pedido por cualquier vía
- **THEN** el sistema rechaza la operación
- **AND** nada cambia

### Requirement: Pedidos activos del día
El panel MUST mostrar los pedidos del día en estado «Recibido» o «En preparación», ordenados del más antiguo al más reciente según el momento de su confirmación. Cada pedido MUST mostrar su número, su mesa, su estado y cada línea con cantidad, nombre del plato, tamaño si tiene nombre y la nota del comensal si la tiene.

#### Scenario: El personal ve los pedidos pendientes
- **GIVEN** hoy se han confirmado el pedido 4 de «Mesa 2» a las 13:05 y el pedido 5 de «Terraza 1» a las 13:09, ambos en «Recibido»
- **AND** el pedido 4 tiene la línea «Croquetas · Ración» × 2 con la nota «Bien calientes»
- **WHEN** el personal abre el panel de cocina
- **THEN** ve primero el pedido 4 y después el pedido 5
- **AND** en el pedido 4 ve la mesa «Mesa 2», el estado «Recibido» y la línea «2 × Croquetas · Ración» con la nota «Bien calientes»

#### Scenario: Los pedidos servidos o cancelados no están en la vista activa
- **GIVEN** hoy el pedido 2 está «Servido», el pedido 3 «Cancelado» y el pedido 4 «En preparación»
- **WHEN** el personal abre el panel de cocina
- **THEN** ve el pedido 4 en la vista activa
- **AND** no ve los pedidos 2 ni 3 en la vista activa

### Requirement: Tiempo transcurrido de cada pedido
Cada pedido de la vista activa MUST mostrar el tiempo transcurrido desde su confirmación, en minutos (y en horas y minutos a partir de una hora), y MUST actualizarlo mientras el panel está abierto sin que el personal recargue la página.

#### Scenario: El tiempo transcurrido avanza solo
- **GIVEN** el pedido 4 se confirmó hace 7 minutos y el panel está abierto
- **WHEN** pasan 3 minutos sin que el personal toque nada
- **THEN** el pedido 4 muestra que lleva 10 minutos

#### Scenario: Un pedido lleva más de una hora
- **GIVEN** el pedido 4 se confirmó hace 75 minutos y sigue «En preparación»
- **WHEN** el personal mira el panel
- **THEN** el pedido 4 muestra que lleva 1 h 15 min

### Requirement: Los pedidos nuevos aparecen solos
Cuando un comensal confirma un pedido, el pedido MUST aparecer en el panel de cocina abierto, en su posición por antigüedad, sin que el personal recargue la página. El panel MUST avisar de cada pedido nuevo con un resaltado visual del pedido y un sonido breve.

#### Scenario: Llega un pedido mientras el panel está abierto
- **GIVEN** el personal tiene el panel de cocina abierto con el pedido 4 en «Recibido»
- **WHEN** un comensal de «Mesa 6» confirma el pedido 5
- **THEN** el pedido 5 aparece en el panel después del pedido 4 sin recargar la página
- **AND** el pedido 5 se muestra resaltado como nuevo y suena un aviso breve

### Requirement: Los cambios de otros dispositivos aparecen solos
Cuando el estado de un pedido cambia desde otro dispositivo (otra tablet del personal o el panel abierto por el dueño), el panel MUST reflejar el cambio sin recargar la página.

#### Scenario: Dos tablets con el panel abierto
- **GIVEN** la tablet de cocina y la tablet de barra tienen el panel abierto con el pedido 4 en «Recibido»
- **WHEN** desde la tablet de cocina se pasa el pedido 4 a «En preparación»
- **THEN** la tablet de barra muestra el pedido 4 en «En preparación» sin recargar la página

### Requirement: Aviso de conexión perdida
Si el panel deja de poder recibir pedidos (por ejemplo, porque la tablet pierde la conexión), MUST mostrar un aviso visible de que los pedidos no se están actualizando. Al recuperar la conexión, el panel MUST mostrar los pedidos y estados que cambiaron mientras tanto y retirar el aviso.

#### Scenario: La tablet pierde la wifi durante el servicio
- **GIVEN** el personal tiene el panel de cocina abierto
- **WHEN** la tablet pierde la conexión
- **THEN** el panel muestra un aviso visible de que los pedidos no se están actualizando
- **WHEN** un comensal confirma el pedido 7 y, después, la tablet recupera la conexión
- **THEN** el pedido 7 aparece en el panel sin recargar la página
- **AND** el aviso desaparece

### Requirement: Ciclo de estados del pedido
El estado de un pedido MUST seguir solo estas transiciones: de «Recibido» a «En preparación» y de «En preparación» a «Servido». El sistema MUST rechazar cualquier otra transición (saltar de «Recibido» a «Servido», volver a un estado anterior o cambiar un pedido «Servido» o «Cancelado»), aunque se intente sin pasar por la interfaz. Cada cambio MUST registrar su momento.

#### Scenario: La cocina empieza a preparar un pedido
- **GIVEN** el pedido 4 está en «Recibido»
- **WHEN** el personal elige «Empezar» en el pedido 4
- **THEN** el pedido 4 pasa a «En preparación»
- **AND** el pedido 4 ya no ofrece la acción «Empezar» ni la de cancelar, sino «Servido»

#### Scenario: El pedido sale a la mesa
- **GIVEN** el pedido 4 está en «En preparación»
- **WHEN** el personal elige «Servido» en el pedido 4
- **THEN** el pedido 4 pasa a «Servido»
- **AND** sale de la vista activa y aparece en el histórico del día

#### Scenario: El panel no permite saltar estados
- **GIVEN** el pedido 4 está en «Recibido»
- **WHEN** el personal mira el pedido 4 en el panel
- **THEN** no ve ninguna acción para marcarlo como «Servido» directamente

#### Scenario: Intento de saltar o retroceder un estado fuera de la interfaz
- **GIVEN** el pedido 4 está en «Recibido» y el pedido 2 está «Servido»
- **WHEN** alguien con sesión de personal intenta, por cualquier vía, pasar el pedido 4 a «Servido» o devolver el pedido 2 a «En preparación»
- **THEN** el sistema rechaza ambas operaciones
- **AND** los pedidos 4 y 2 conservan su estado

### Requirement: Cancelación de un pedido recibido
El personal MUST poder cancelar un pedido solo mientras está en «Recibido», tras confirmar la cancelación en un segundo paso. Cancelar MUST registrar el momento de la cancelación, MUST NOT borrar el pedido y MUST dejarlo en el estado final «Cancelado». El sistema MUST rechazar la cancelación de un pedido en cualquier otro estado, aunque se intente sin pasar por la interfaz.

#### Scenario: El personal cancela un pedido recibido
- **GIVEN** el pedido 5 de «Mesa 6» está en «Recibido»
- **WHEN** el personal elige cancelar el pedido 5
- **THEN** el panel le pide confirmar que quiere cancelar el pedido 5 de «Mesa 6»
- **WHEN** confirma
- **THEN** el pedido 5 pasa a «Cancelado» y sale de la vista activa
- **AND** aparece en el histórico del día como cancelado, con la hora de la cancelación

#### Scenario: El personal se arrepiente de cancelar
- **GIVEN** el panel pide confirmar la cancelación del pedido 5
- **WHEN** el personal elige no cancelar
- **THEN** el pedido 5 sigue en «Recibido» en la vista activa

#### Scenario: Un pedido en preparación no se puede cancelar
- **GIVEN** el pedido 4 está en «En preparación»
- **WHEN** el personal mira el pedido 4 en el panel
- **THEN** no ve ninguna acción para cancelarlo
- **AND** un intento de cancelarlo por cualquier vía es rechazado y el pedido sigue en «En preparación»

### Requirement: Cambio de estado ya hecho desde otro dispositivo
Si el personal intenta cambiar el estado de un pedido o cancelarlo cuando otro dispositivo ya lo ha cambiado, el sistema MUST NOT aplicar la acción, MUST indicar que el pedido ya había cambiado y MUST mostrar su estado actual.

#### Scenario: Cancelar un pedido que otra tablet acaba de empezar
- **GIVEN** la tablet de barra muestra todavía el pedido 5 en «Recibido»
- **AND** desde la tablet de cocina se acaba de pasar el pedido 5 a «En preparación»
- **WHEN** desde la tablet de barra se confirma la cancelación del pedido 5
- **THEN** el sistema no cancela el pedido 5
- **AND** la tablet de barra indica que el pedido ya había cambiado y lo muestra en «En preparación»

### Requirement: Histórico del día
El personal MUST poder consultar desde el panel el histórico del día con los pedidos «Servido» y «Cancelado», del más reciente al más antiguo según la hora en que se sirvieron o cancelaron. Cada pedido del histórico MUST mostrar su número, su mesa, sus líneas con cantidad, tamaño y nota, su estado y la hora en que se sirvió o se canceló.

#### Scenario: El personal consulta lo servido hoy
- **GIVEN** hoy se sirvió el pedido 2 a las 12:40 y se canceló el pedido 3 a las 12:55
- **WHEN** el personal abre el histórico del día desde el panel
- **THEN** ve primero el pedido 3, «Cancelado» a las 12:55, y después el pedido 2, «Servido» a las 12:40, cada uno con su mesa y sus líneas

### Requirement: Solo los pedidos del día
El panel y su histórico MUST mostrar solo los pedidos del día de servicio en curso, el mismo día de servicio que usa la numeración de los pedidos. Los pedidos de días de servicio anteriores MUST NOT aparecer, cualquiera que sea su estado.

#### Scenario: Un pedido de ayer quedó sin servir
- **GIVEN** en el día de servicio anterior el pedido 57 quedó en «Recibido»
- **WHEN** hoy el personal abre el panel de cocina o el histórico del día
- **THEN** no ve el pedido 57 del día de servicio anterior

#### Scenario: Los pedidos de madrugada siguen en el panel
- **GIVEN** a las 02:00 se confirmó el pedido 41, que sigue en «Recibido»
- **WHEN** el personal abre el panel de cocina a las 02:30
- **THEN** ve el pedido 41 junto a los pedidos de la noche anterior

### Requirement: Panel sin pedidos
Cuando no hay pedidos activos, el panel MUST indicar que no hay pedidos pendientes y que los nuevos aparecerán solos. Cuando el histórico del día está vacío, MUST indicar que todavía no se ha servido ni cancelado ningún pedido hoy.

#### Scenario: Primera hora del servicio
- **GIVEN** hoy todavía no se ha confirmado ningún pedido
- **WHEN** el personal abre el panel de cocina
- **THEN** ve un mensaje que indica que no hay pedidos pendientes y que los nuevos aparecerán solos

### Requirement: Accesibilidad del panel
El panel de cocina y su histórico MUST cumplir WCAG 2.2 nivel AA, con contraste de texto de al menos 7:1 y objetivos táctiles de al menos 44×44 CSS px, y MUST poder leerse en una tablet apoyada en la barra. Los pedidos nuevos y los cambios de estado MUST anunciarse a los lectores de pantalla.

#### Scenario: El personal usa el panel en la barra
- **GIVEN** el panel de cocina está abierto en una tablet apoyada en la barra
- **WHEN** el personal lee un pedido o toca «Empezar», «Servido» o cancelar
- **THEN** todo texto tiene un contraste de al menos 7:1 con su fondo
- **AND** todo control tiene un área táctil de al menos 44×44 CSS px y se anuncia con el número de pedido al que afecta

#### Scenario: Llega un pedido con lector de pantalla activo
- **GIVEN** un miembro del personal usa el panel con un lector de pantalla
- **WHEN** llega el pedido 5 de «Mesa 6»
- **THEN** el lector anuncia que ha llegado el pedido 5 de «Mesa 6»

### Requirement: Pantalla encendida mientras el panel está abierto
Mientras el panel de cocina está abierto y visible, el sistema MUST pedir al dispositivo que mantenga la pantalla encendida, si el navegador lo permite. Si el navegador no lo permite, el panel MUST seguir funcionando igual.

#### Scenario: La tablet no se apaga durante el servicio
- **GIVEN** el panel de cocina está abierto en una tablet cuyo navegador permite mantener la pantalla encendida
- **WHEN** pasan varios minutos sin que el personal toque la tablet
- **THEN** la pantalla sigue encendida y mostrando los pedidos

#### Scenario: Un navegador que no permite mantener la pantalla encendida
- **GIVEN** el navegador de la tablet no permite mantener la pantalla encendida
- **WHEN** el personal abre el panel de cocina
- **THEN** ve los pedidos y puede gestionarlos con normalidad

### Requirement: Activación del aviso sonoro
Mientras el navegador no permita reproducir el aviso sonoro de pedido nuevo hasta que alguien toque la pantalla, el panel MUST mostrar una acción visible para activar el aviso sonoro. Tras tocarla, o tras cualquier otro toque en el panel, el aviso MUST quedar activo y la acción MUST dejar de mostrarse.

#### Scenario: El personal activa el sonido al abrir el panel
- **GIVEN** el personal acaba de abrir el panel y el navegador mantiene el sonido bloqueado
- **WHEN** mira el panel
- **THEN** ve la acción «Activar el aviso sonoro»
- **WHEN** la toca
- **THEN** la acción desaparece y el siguiente pedido nuevo suena

### Requirement: Duración del resaltado de un pedido nuevo
Un pedido que llega mientras el panel está abierto MUST mostrarse resaltado como nuevo durante 2 minutos o hasta que el personal elige «Empezar» en él, lo que ocurra antes.

#### Scenario: El resaltado desaparece al empezar el pedido
- **GIVEN** el pedido 5 acaba de llegar y se muestra resaltado como nuevo
- **WHEN** el personal elige «Empezar» en el pedido 5
- **THEN** el pedido 5 deja de mostrarse resaltado como nuevo

#### Scenario: El resaltado desaparece a los 2 minutos
- **GIVEN** el pedido 5 llegó hace 2 minutos y sigue en «Recibido»
- **WHEN** el personal mira el panel
- **THEN** el pedido 5 ya no se muestra resaltado como nuevo
