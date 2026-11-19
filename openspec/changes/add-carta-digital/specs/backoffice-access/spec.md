# Spec Delta: backoffice-access

## Purpose

El acceso a la zona privada de Menu-now (la administración), que exige una sesión iniciada con una cuenta dada de alta para el local. En este cambio la usa el dueño; el personal la reutilizará en cambios posteriores.

## ADDED Requirements

### Requirement: La administración exige sesión del dueño
El sistema MUST exigir una sesión iniciada con una cuenta de dueño para ver o usar cualquier pantalla de la administración, y MUST rechazar cualquier modificación del catálogo que no proceda de una sesión de dueño, aunque se intente sin pasar por la interfaz.

#### Scenario: Acceso a la administración sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** abre la dirección de la administración o de cualquiera de sus pantallas
- **THEN** el sistema no muestra ningún dato ni acción de la administración
- **AND** le muestra la pantalla de inicio de sesión

#### Scenario: Intento de modificar el catálogo sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** intenta crear, editar, archivar o reordenar un plato o una categoría por cualquier vía
- **THEN** el sistema rechaza la operación
- **AND** el catálogo no cambia

### Requirement: Inicio y cierre de sesión del dueño
El dueño MUST poder iniciar sesión con su correo electrónico y su contraseña y cerrar sesión desde la administración. Tras iniciar sesión, MUST llegar a la pantalla de la administración que intentaba abrir. Ante credenciales incorrectas, el sistema MUST mostrar un mensaje genérico que no revele si el correo existe.

#### Scenario: El dueño inicia sesión
- **GIVEN** el dueño intentó abrir la administración sin sesión y ve la pantalla de inicio de sesión
- **WHEN** introduce su correo y su contraseña correctos
- **THEN** accede a la pantalla de la administración que intentaba abrir

#### Scenario: El dueño introduce una contraseña incorrecta
- **GIVEN** el dueño está en la pantalla de inicio de sesión
- **WHEN** introduce su correo con una contraseña incorrecta
- **THEN** el sistema no inicia la sesión
- **AND** muestra un mensaje genérico de credenciales incorrectas

#### Scenario: El dueño cierra sesión
- **GIVEN** el dueño tiene la sesión iniciada en la administración
- **WHEN** cierra sesión
- **THEN** vuelve a la pantalla de inicio de sesión
- **AND** no puede volver a ver la administración sin iniciar sesión de nuevo

### Requirement: Sin registro público de cuentas
El sistema MUST NOT ofrecer ninguna forma pública de crear cuentas. La cuenta del dueño se da de alta al instalar cada local.

#### Scenario: Nadie puede registrarse desde la aplicación
- **GIVEN** una persona que no tiene cuenta
- **WHEN** recorre la carta o la pantalla de inicio de sesión
- **THEN** no encuentra ninguna opción para registrarse
- **AND** un intento de alta de cuenta fuera de la interfaz es rechazado por el sistema
