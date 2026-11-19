# Spec Delta

## ADDED Requirements

### Requirement: Cuentas de personal
El sistema MUST admitir una o varias cuentas de personal, cada una con su propio correo y contraseña. El personal MUST iniciar sesión, cerrar sesión y restablecer su contraseña igual que el dueño; tras iniciar sesión MUST llegar al panel de cocina.

#### Scenario: El personal inicia sesión en la tablet
- **GIVEN** el personal abre la pantalla de inicio de sesión en la tablet de la barra
- **WHEN** introduce el correo y la contraseña correctos de una cuenta de personal
- **THEN** llega al panel de cocina

#### Scenario: El personal cierra sesión
- **GIVEN** el personal tiene la sesión iniciada en el panel de cocina
- **WHEN** cierra sesión
- **THEN** vuelve a la pantalla de inicio de sesión
- **AND** no puede volver a ver el panel sin iniciar sesión de nuevo

### Requirement: El personal solo accede al panel de cocina
Una sesión de personal MUST NOT ver ni usar ninguna pantalla de la administración distinta del panel de cocina y su histórico, y el sistema MUST rechazar cualquier modificación del catálogo, de los datos del local o de las mesas que proceda de una sesión de personal, aunque se intente sin pasar por la interfaz.

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

## MODIFIED Requirements

### Requirement: Sin registro público de cuentas
El sistema MUST NOT ofrecer ninguna forma pública de crear cuentas. Las cuentas de dueño y de personal se dan de alta al instalar el local.

#### Scenario: Nadie puede registrarse desde la aplicación
- **GIVEN** una persona que no tiene cuenta
- **WHEN** recorre la carta, el panel de cocina o la pantalla de inicio de sesión
- **THEN** no encuentra ninguna opción para registrarse
- **AND** un intento de alta de cuenta fuera de la interfaz es rechazado por el sistema
