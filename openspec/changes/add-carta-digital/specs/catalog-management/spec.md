# Spec Delta: catalog-management

## Purpose

La gestión del catálogo por parte del dueño desde una administración pensada para el móvil: categorías y platos, su orden, su archivado y reactivación, la declaración de alérgenos y la foto de cada plato, con las validaciones que garantizan una carta correcta.

## ADDED Requirements

### Requirement: Gestión de categorías
El dueño MUST poder crear una categoría con un nombre y editar el nombre de una categoría existente. Una categoría nueva MUST quedar al final del orden de categorías.

#### Scenario: El dueño crea una categoría
- **GIVEN** el dueño ha iniciado sesión y existen las categorías «Desayunos» y «Bebidas»
- **WHEN** el dueño crea la categoría «Postres»
- **THEN** «Postres» aparece en la administración detrás de «Bebidas»

#### Scenario: El dueño intenta guardar una categoría sin nombre
- **GIVEN** el dueño ha iniciado sesión
- **WHEN** el dueño intenta guardar una categoría con el nombre vacío
- **THEN** el sistema no la guarda
- **AND** le indica que el nombre es obligatorio

### Requirement: Gestión de platos
El dueño MUST poder crear un plato dentro de una categoría y editar cualquiera de sus datos, incluida la categoría a la que pertenece. Un plato nuevo, o movido a otra categoría, MUST quedar al final de su categoría.

#### Scenario: El dueño crea un plato
- **GIVEN** el dueño ha iniciado sesión y existe la categoría «Bocadillos»
- **WHEN** el dueño crea en «Bocadillos» el plato «Lomo con queso», 4,50 €, descripción «Lomo a la plancha y queso manchego», alérgenos «Gluten» y «Leche»
- **THEN** el plato queda guardado como activo al final de «Bocadillos»
- **AND** el comensal lo ve en la carta

#### Scenario: El dueño edita el precio de un plato
- **GIVEN** el plato «Caña» cuesta 1,80 €
- **WHEN** el dueño cambia su precio a 2,00 € y guarda
- **THEN** el comensal ve «Caña» a 2,00 € al abrir o recargar la carta

### Requirement: Datos obligatorios del plato
El sistema MUST rechazar guardar un plato sin nombre, sin descripción corta, sin categoría o sin un precio en euros mayor que cero con como máximo dos decimales. La foto es el único dato opcional del plato.

#### Scenario: El dueño intenta guardar un plato con precio no válido
- **GIVEN** el dueño está creando un plato
- **WHEN** intenta guardarlo con un precio de 0 €
- **THEN** el sistema no lo guarda
- **AND** le indica que el precio debe ser mayor que cero

#### Scenario: El dueño guarda un plato sin foto
- **GIVEN** el dueño está creando el plato «Café solo» con todos los datos obligatorios
- **WHEN** lo guarda sin añadir foto
- **THEN** el sistema guarda el plato

### Requirement: Declaración de alérgenos obligatoria
Cada plato MUST tener exactamente una de estas dos declaraciones: una lista con al menos uno de los 14 alérgenos del Reglamento (UE) 1169/2011, Anexo II, o la declaración explícita «sin alérgenos». El sistema MUST rechazar guardar un plato sin ninguna de las dos o con ambas.

#### Scenario: El dueño guarda un plato declarado sin alérgenos
- **GIVEN** el dueño está creando el plato «Agua mineral» con todos los datos obligatorios
- **WHEN** marca «Sin alérgenos» y guarda
- **THEN** el sistema guarda el plato con la declaración «sin alérgenos»

#### Scenario: El dueño intenta guardar un plato sin declaración de alérgenos
- **GIVEN** el dueño está creando el plato «Ensaladilla» con todos los demás datos obligatorios
- **WHEN** intenta guardarlo sin seleccionar ningún alérgeno y sin marcar «Sin alérgenos»
- **THEN** el sistema no guarda el plato
- **AND** le indica que debe declarar los alérgenos o marcar «Sin alérgenos»

#### Scenario: El dueño no puede combinar alérgenos y «sin alérgenos»
- **GIVEN** el plato «Tostada» tiene declarado el alérgeno «Gluten»
- **WHEN** el dueño marca «Sin alérgenos»
- **THEN** el plato deja de tener alérgenos seleccionados, de modo que solo queda una declaración

### Requirement: Archivado y reactivación
El dueño MUST poder archivar y reactivar platos y categorías. El sistema MUST NOT ofrecer el borrado de platos ni de categorías: un elemento archivado se conserva con todos sus datos. Los elementos archivados MUST seguir visibles para el dueño en la administración, separados de los activos.

#### Scenario: El dueño archiva un plato y este se conserva
- **GIVEN** el plato «Croquetas» está activo
- **WHEN** el dueño archiva «Croquetas»
- **THEN** «Croquetas» deja de aparecer en la carta del comensal
- **AND** el dueño sigue viendo «Croquetas», marcado como archivado, con todos sus datos

#### Scenario: El dueño reactiva un plato archivado
- **GIVEN** el plato «Croquetas» está archivado
- **WHEN** el dueño lo reactiva
- **THEN** «Croquetas» vuelve a aparecer en la carta del comensal en su categoría

#### Scenario: El dueño archiva el último plato activo de una categoría
- **GIVEN** la categoría «Postres» tiene un único plato activo, «Flan»
- **WHEN** el dueño archiva «Flan»
- **THEN** la categoría «Postres» sigue existiendo en la administración
- **AND** el dueño ve que no tiene platos activos y que no se muestra en la carta

### Requirement: Reordenación
El dueño MUST poder cambiar el orden de las categorías y el orden de los platos activos dentro de cada categoría. El nuevo orden MUST reflejarse en la carta del comensal.

#### Scenario: El dueño sube un plato en su categoría
- **GIVEN** en «Bocadillos» los platos activos están en el orden «Calamares», «Lomo», «Tortilla»
- **WHEN** el dueño sube «Tortilla» una posición
- **THEN** el orden pasa a ser «Calamares», «Tortilla», «Lomo» en la administración y en la carta

#### Scenario: El dueño baja una categoría
- **GIVEN** las categorías están en el orden «Desayunos», «Bocadillos», «Bebidas»
- **WHEN** el dueño baja «Desayunos» una posición
- **THEN** el orden pasa a ser «Bocadillos», «Desayunos», «Bebidas» en la administración y en la carta

### Requirement: Foto del plato
El dueño MUST poder añadir, sustituir y quitar la foto de un plato. El sistema MUST aceptar solo imágenes JPEG, PNG o WebP de hasta 5 MB y MUST rechazar cualquier otro archivo, informando del motivo, sin perder el resto de datos del plato.

#### Scenario: El dueño intenta subir una foto de más de 5 MB
- **GIVEN** el dueño está editando el plato «Paella»
- **WHEN** elige una foto de 7 MB
- **THEN** el sistema rechaza la foto
- **AND** le indica que el tamaño máximo es 5 MB
- **AND** conserva los demás datos que el dueño ha introducido en el plato

#### Scenario: El dueño quita la foto de un plato
- **GIVEN** el plato «Paella» tiene foto
- **WHEN** el dueño quita la foto y guarda
- **THEN** el comensal ve «Paella» sin foto en la carta

### Requirement: Administración pensada para el móvil
La administración del catálogo MUST poder usarse por completo desde la pantalla de un móvil, sin desplazamiento horizontal, con controles de al menos 44×44 CSS px, y sus textos de interfaz MUST estar disponibles en español (por defecto) e inglés.

#### Scenario: El dueño gestiona el catálogo desde su móvil
- **GIVEN** el dueño ha iniciado sesión desde un móvil con pantalla de 360 CSS px de ancho
- **WHEN** crea, edita, archiva y reordena platos y categorías
- **THEN** puede completar todas esas acciones sin desplazamiento horizontal
- **AND** todos los controles tienen un área táctil de al menos 44×44 CSS px
