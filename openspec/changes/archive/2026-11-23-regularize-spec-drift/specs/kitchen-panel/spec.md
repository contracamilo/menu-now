## ADDED Requirements

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

## MODIFIED Requirements

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
