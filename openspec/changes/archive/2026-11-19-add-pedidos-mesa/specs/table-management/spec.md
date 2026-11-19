# Spec Delta

## Purpose

Las mesas del local que gestiona el dueño desde la administración —su alta, su nombre, su archivado y reactivación— y el QR único de cada mesa que abre la carta con esa mesa identificada.

## ADDED Requirements

### Requirement: Gestión de mesas
El dueño MUST poder crear una mesa con un nombre y editar el nombre de una mesa existente desde la administración. El sistema MUST rechazar un nombre vacío y un nombre igual al de otra mesa activa (sin distinguir mayúsculas). La administración MUST mostrar las mesas activas ordenadas por nombre.

#### Scenario: El dueño crea una mesa
- **GIVEN** el dueño ha iniciado sesión
- **WHEN** abre «Mesas» y crea la mesa «Terraza 2»
- **THEN** «Terraza 2» aparece en la lista de mesas activas

#### Scenario: El dueño intenta guardar una mesa sin nombre
- **GIVEN** el dueño está creando una mesa
- **WHEN** intenta guardarla con el nombre vacío
- **THEN** el sistema no la guarda
- **AND** le indica que el nombre es obligatorio

#### Scenario: El dueño intenta repetir el nombre de una mesa activa
- **GIVEN** existe la mesa activa «Mesa 4»
- **WHEN** el dueño intenta crear otra mesa llamada «mesa 4»
- **THEN** el sistema no la guarda
- **AND** le indica que ya existe una mesa activa con ese nombre

### Requirement: QR único de cada mesa
Cada mesa MUST tener un QR propio, distinto del de cualquier otra mesa, que abre la carta con esa mesa identificada. El dueño MUST poder ver, descargar e imprimir el QR de cada mesa desde la administración, junto al nombre de la mesa. El QR de una mesa MUST NOT cambiar al editar su nombre.

#### Scenario: El dueño imprime el QR de una mesa
- **GIVEN** existe la mesa activa «Mesa 4»
- **WHEN** el dueño abre el QR de «Mesa 4» en la administración y elige imprimirlo
- **THEN** obtiene una página imprimible con el QR y el nombre «Mesa 4»
- **AND** al escanear ese QR, un comensal abre la carta con la mesa «Mesa 4» identificada

#### Scenario: Dos mesas tienen QR distintos
- **GIVEN** existen las mesas activas «Mesa 1» y «Mesa 2»
- **WHEN** un comensal escanea el QR de «Mesa 1» y otro escanea el de «Mesa 2»
- **THEN** el primero ve la carta con «Mesa 1» identificada y el segundo con «Mesa 2»

#### Scenario: Renombrar una mesa no invalida su QR impreso
- **GIVEN** el QR de la mesa «Mesa 4» está impreso en la mesa
- **WHEN** el dueño cambia el nombre de la mesa a «Ventana 1»
- **AND** un comensal escanea el QR impreso
- **THEN** el comensal ve la carta con la mesa «Ventana 1» identificada

### Requirement: Archivado y reactivación de mesas
El dueño MUST poder archivar una mesa activa y reactivar una mesa archivada. No existe el borrado de mesas. Una mesa archivada MUST NOT admitir pedidos nuevos y MUST mostrarse aparte de las activas en la administración. Al reactivarla, su QR MUST volver a servir para pedir.

#### Scenario: El dueño archiva una mesa
- **GIVEN** la mesa «Terraza 2» está activa
- **WHEN** el dueño la archiva
- **THEN** «Terraza 2» aparece en la administración entre las mesas archivadas
- **AND** un comensal que escanea su QR puede consultar la carta pero no puede hacer pedidos

#### Scenario: El dueño reactiva una mesa archivada
- **GIVEN** la mesa «Terraza 2» está archivada
- **WHEN** el dueño la reactiva
- **THEN** «Terraza 2» vuelve a la lista de mesas activas
- **AND** un comensal que escanea su QR impreso puede volver a hacer pedidos

#### Scenario: El dueño no puede reactivar una mesa con el nombre de otra activa
- **GIVEN** la mesa «Mesa 4» está archivada y existe otra mesa activa llamada «Mesa 4»
- **WHEN** el dueño intenta reactivar la mesa archivada
- **THEN** el sistema no la reactiva
- **AND** le indica que ya existe una mesa activa con ese nombre

### Requirement: Solo el dueño gestiona las mesas
El sistema MUST rechazar crear, renombrar, archivar o reactivar una mesa si la operación no procede de una sesión de dueño, aunque se intente sin pasar por la interfaz.

#### Scenario: Intento de crear una mesa sin sesión
- **GIVEN** una persona que no ha iniciado sesión
- **WHEN** intenta crear, renombrar, archivar o reactivar una mesa por cualquier vía
- **THEN** el sistema rechaza la operación
- **AND** nada cambia

### Requirement: Local sin mesas
Cuando no hay ninguna mesa activa, la pantalla «Mesas» de la administración MUST indicar al dueño que cree sus mesas para que los comensales puedan pedir desde ellas.

#### Scenario: El dueño abre «Mesas» por primera vez
- **GIVEN** el dueño todavía no ha creado ninguna mesa
- **WHEN** abre «Mesas» en la administración
- **THEN** ve un mensaje que le invita a crear sus mesas para que los comensales puedan pedir
- **AND** ve la acción para crear una mesa
