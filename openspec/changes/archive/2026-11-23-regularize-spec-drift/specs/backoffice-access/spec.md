## MODIFIED Requirements

### Requirement: El personal solo accede al panel de cocina
Una sesión de personal MUST NOT ver ni usar ninguna pantalla de la administración distinta del panel de cocina y su histórico, y el sistema MUST rechazar cualquier modificación del catálogo, de los datos del local o de las mesas que proceda de una sesión de personal, aunque se intente sin pasar por la interfaz. Una sesión de personal MUST poder leer, fuera de la interfaz, el nombre, el estado y el QR de las mesas.

#### Scenario: El personal intenta abrir la carta en la administración
- **GIVEN** el personal ha iniciado sesión con una cuenta de personal
- **WHEN** abre la dirección de «Mi carta», «Mi local» o «Mesas» de la administración
- **THEN** el sistema no muestra ningún dato ni acción de esas pantallas
- **AND** le lleva al panel de cocina

#### Scenario: El personal intenta modificar la carta fuera de la interfaz
- **GIVEN** una sesión de personal
- **WHEN** intenta crear, editar o archivar un plato, una categoría o una mesa, o cambiar los datos del local, por cualquier vía
- **THEN** el sistema rechaza la operación
- **AND** nada cambia

#### Scenario: El personal lee las mesas fuera de la interfaz
- **GIVEN** una sesión de personal y las mesas «Mesa 4» (activa) y «Terraza 2» (archivada)
- **WHEN** consulta las mesas sin pasar por la interfaz
- **THEN** obtiene el nombre, el estado y el QR de «Mesa 4» y de «Terraza 2»
- **AND** no puede cambiar ninguno de esos datos
