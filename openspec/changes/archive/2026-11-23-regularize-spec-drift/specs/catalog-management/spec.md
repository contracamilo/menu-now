## ADDED Requirements

### Requirement: Longitud máxima de los textos del catálogo
El sistema MUST rechazar un nombre de categoría de más de 40 caracteres, un nombre de plato de más de 80, una descripción corta de más de 160, un texto de «con qué compra se incluye» de más de 60 y un nombre de tamaño de más de 20. Mientras el dueño escribe cada uno de estos textos, la administración MUST mostrar cuántos caracteres lleva de los permitidos y MUST NOT admitir más.

#### Scenario: El dueño escribe una descripción larga
- **GIVEN** el dueño está editando el plato «Paella»
- **WHEN** escribe una descripción de 160 caracteres e intenta seguir escribiendo
- **THEN** la descripción no admite más caracteres
- **AND** el dueño ve que lleva 160 de los 160 caracteres permitidos

#### Scenario: Intento de guardar un nombre demasiado largo fuera de la interfaz
- **GIVEN** una sesión de dueño
- **WHEN** intenta guardar, por cualquier vía, una categoría con un nombre de 41 caracteres
- **THEN** el sistema no la guarda

### Requirement: Precio máximo de un tamaño
El sistema MUST rechazar un precio de tamaño superior a 99 999,99 € e indicar al dueño que el precio no es válido.

#### Scenario: El dueño escribe un precio demasiado alto
- **GIVEN** el dueño está creando el plato «Caña»
- **WHEN** escribe el precio 100000 y guarda
- **THEN** el sistema no guarda el plato
- **AND** le indica que el precio no es válido

### Requirement: Reactivar una categoría con el nombre de otra activa
El sistema MUST NOT reactivar una categoría archivada si existe otra categoría activa con el mismo nombre (sin distinguir mayúsculas), y MUST indicar al dueño que ya existe una categoría activa con ese nombre.

#### Scenario: El dueño intenta reactivar una categoría con nombre repetido
- **GIVEN** la categoría «Postres» está archivada y existe otra categoría activa llamada «postres»
- **WHEN** el dueño intenta reactivar la categoría archivada
- **THEN** el sistema no la reactiva
- **AND** le indica que ya existe una categoría activa con ese nombre
