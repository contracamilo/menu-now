# Spec Delta: backoffice-access

## Purpose

El acceso a la zona privada de Menu-now (la administración), que exige una sesión iniciada con una cuenta dada de alta para el local. En este cambio la usan los dueños; el personal la reutilizará en cambios posteriores.

## ADDED Requirements

### Requirement: La administración exige sesión de dueño
El sistema MUST exigir una sesión iniciada con una cuenta de dueño para ver o usar cualquier pantalla de la administración, y MUST rechazar cualquier modificación del catálogo o de los datos del local que no proceda de una sesión de dueño, aunque se intente sin pasar por la interfaz.

#### Scenario: Acceso a la administración sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** abre la dirección de la administración o de cualquiera de sus pantallas
- **THEN** el sistema no muestra ningún dato ni acción de la administración
- **AND** le muestra la pantalla de inicio de sesión

#### Scenario: Intento de modificar el catálogo sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** intenta crear, editar, archivar o reordenar un plato o una categoría, o cambiar el nombre o el logo del local, por cualquier vía
- **THEN** el sistema rechaza la operación
- **AND** nada cambia

### Requirement: Varias cuentas de dueño
El sistema MUST admitir varias cuentas de dueño en un mismo local, cada una con su propio correo y contraseña y con los mismos permisos sobre la administración.

#### Scenario: Dos dueños gestionan la misma carta
- **GIVEN** el local tiene dos dueños, cada uno con su cuenta
- **WHEN** uno de ellos cambia el precio de un plato
- **AND** el otro inicia sesión con su propia cuenta
- **THEN** el segundo dueño ve el precio cambiado y puede editar el mismo catálogo

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

### Requirement: Restablecimiento de contraseña
Desde la pantalla de inicio de sesión, el dueño MUST poder pedir un enlace por correo para crear una contraseña nueva. El sistema MUST responder con el mismo mensaje exista o no el correo. El enlace MUST caducar y MUST servir una sola vez. La contraseña nueva MUST tener al menos 8 caracteres.

#### Scenario: El dueño pide restablecer su contraseña
- **GIVEN** el dueño ha olvidado su contraseña y está en la pantalla de inicio de sesión
- **WHEN** elige «¿Has olvidado tu contraseña?» e introduce su correo
- **THEN** ve un mensaje que indica que, si el correo corresponde a una cuenta, recibirá un enlace
- **AND** recibe en su correo un enlace para crear una contraseña nueva

#### Scenario: Se pide restablecer la contraseña de un correo sin cuenta
- **GIVEN** una persona en la pantalla de inicio de sesión
- **WHEN** pide restablecer la contraseña de un correo que no corresponde a ninguna cuenta
- **THEN** ve exactamente el mismo mensaje que vería un dueño
- **AND** no se envía ningún enlace

#### Scenario: El dueño crea una contraseña nueva
- **GIVEN** el dueño ha abierto el enlace de restablecimiento recibido por correo
- **WHEN** introduce una contraseña nueva de al menos 8 caracteres y la guarda
- **THEN** el sistema la guarda y le lleva a la administración
- **AND** la contraseña anterior deja de servir

#### Scenario: El dueño usa un enlace caducado o ya usado
- **GIVEN** el dueño abre un enlace de restablecimiento caducado o que ya utilizó
- **WHEN** intenta crear una contraseña nueva
- **THEN** el sistema no cambia la contraseña
- **AND** le indica que el enlace no es válido y que pida uno nuevo

### Requirement: Sin registro público de cuentas
El sistema MUST NOT ofrecer ninguna forma pública de crear cuentas. Las cuentas de dueño se dan de alta al instalar el local.

#### Scenario: Nadie puede registrarse desde la aplicación
- **GIVEN** una persona que no tiene cuenta
- **WHEN** recorre la carta o la pantalla de inicio de sesión
- **THEN** no encuentra ninguna opción para registrarse
- **AND** un intento de alta de cuenta fuera de la interfaz es rechazado por el sistema
