# Spec Delta: catalog-management

## Purpose

La gestión del catálogo por parte del dueño desde una administración pensada para el móvil: categorías (incluida «Incluidos») y platos, sus tamaños y precios, su orden, su archivado y reactivación, la declaración de alérgenos y la foto de cada plato, con las validaciones que garantizan una carta correcta.

## ADDED Requirements

### Requirement: Gestión de categorías
El dueño MUST poder crear una categoría con un nombre y editar el nombre de una categoría existente. Una categoría nueva MUST quedar al final del orden de categorías. El sistema MUST rechazar un nombre vacío, un nombre igual al de otra categoría activa (sin distinguir mayúsculas) y los nombres «Incluidos» e «Included».

#### Scenario: El dueño crea una categoría
- **GIVEN** el dueño ha iniciado sesión y existen las categorías «Desayunos» y «Bebidas»
- **WHEN** el dueño crea la categoría «Postres»
- **THEN** «Postres» aparece en la administración detrás de «Bebidas»

#### Scenario: El dueño intenta guardar una categoría sin nombre
- **GIVEN** el dueño ha iniciado sesión
- **WHEN** el dueño intenta guardar una categoría con el nombre vacío
- **THEN** el sistema no la guarda
- **AND** le indica que el nombre es obligatorio

#### Scenario: El dueño intenta repetir el nombre de una categoría activa
- **GIVEN** existe la categoría activa «Bebidas»
- **WHEN** el dueño intenta crear otra categoría llamada «bebidas»
- **THEN** el sistema no la guarda
- **AND** le indica que ya existe una categoría activa con ese nombre

### Requirement: Categoría «Incluidos»
El sistema MUST tener siempre una categoría «Incluidos», cuyo nombre se muestra en el idioma de la interfaz. El dueño MUST poder reordenarla y añadirle platos, y MUST NOT poder renombrarla ni archivarla.

#### Scenario: El dueño encuentra la categoría «Incluidos» desde el primer día
- **GIVEN** el dueño inicia sesión por primera vez en un local recién instalado
- **WHEN** abre la administración del catálogo
- **THEN** ve la categoría «Incluidos», sin opciones para renombrarla ni archivarla
- **AND** puede subirla o bajarla en el orden de categorías

### Requirement: Gestión de platos
El dueño MUST poder crear un plato dentro de una categoría y editar cualquiera de sus datos, incluida la categoría a la que pertenece. Un plato pertenece a una sola categoría. Un plato nuevo, o movido a otra categoría, MUST quedar al final de su categoría. Se permiten platos con el mismo nombre.

#### Scenario: El dueño crea un plato
- **GIVEN** el dueño ha iniciado sesión y existe la categoría «Bocadillos»
- **WHEN** el dueño crea en «Bocadillos» el plato «Lomo con queso», 4,50 €, descripción «Lomo a la plancha y queso manchego», alérgenos «Gluten» y «Leche»
- **THEN** el plato queda guardado como activo al final de «Bocadillos»
- **AND** el comensal lo ve en la carta

#### Scenario: El dueño edita el precio de un plato
- **GIVEN** el plato «Caña» cuesta 1,80 €
- **WHEN** el dueño cambia su precio a 2,00 € y guarda
- **THEN** el comensal ve «Caña» a 2,00 € al abrir o recargar la carta

#### Scenario: El dueño crea dos platos con el mismo nombre
- **GIVEN** existe el plato «Café» en la categoría «Desayunos»
- **WHEN** el dueño crea otro plato «Café» en la categoría «Bebidas»
- **THEN** el sistema guarda ambos platos, cada uno en su categoría

### Requirement: Datos obligatorios del plato
El sistema MUST rechazar guardar un plato sin nombre o sin categoría. La descripción corta y la foto son opcionales.

#### Scenario: El dueño guarda un plato sin descripción ni foto
- **GIVEN** el dueño está creando el plato «Café solo» con nombre, categoría, precio y declaración de alérgenos
- **WHEN** lo guarda sin descripción y sin foto
- **THEN** el sistema guarda el plato

#### Scenario: El dueño intenta guardar un plato sin nombre
- **GIVEN** el dueño está creando un plato
- **WHEN** intenta guardarlo con el nombre vacío
- **THEN** el sistema no lo guarda
- **AND** le indica que el nombre es obligatorio

### Requirement: Tamaños y precios del plato
Un plato fuera de «Incluidos» MUST tener al menos un tamaño, cada uno con un precio en euros mayor que cero y con como máximo dos decimales. Con un solo tamaño, su nombre es opcional; con varios, cada tamaño MUST tener un nombre distinto dentro del plato. El dueño MUST poder añadir, quitar, renombrar y ordenar los tamaños.

#### Scenario: El dueño crea un plato con varios tamaños
- **GIVEN** el dueño está creando el plato «Croquetas» en «Raciones»
- **WHEN** añade los tamaños «Una» a 1,50 €, «Ración» a 7,00 € y «Plato» a 12,00 € y guarda
- **THEN** el sistema guarda el plato con los tres tamaños en ese orden
- **AND** el comensal ve los tres tamaños con sus precios

#### Scenario: El dueño intenta guardar varios tamaños sin nombre
- **GIVEN** el dueño está creando un plato con dos tamaños
- **WHEN** intenta guardarlo dejando sin nombre uno de los tamaños
- **THEN** el sistema no lo guarda
- **AND** le indica que, si hay varios tamaños, cada uno necesita un nombre

#### Scenario: El dueño intenta poner un precio de 0 € fuera de «Incluidos»
- **GIVEN** el dueño está creando un plato en la categoría «Tapas»
- **WHEN** intenta guardarlo con un precio de 0 €
- **THEN** el sistema no lo guarda
- **AND** le indica que el precio debe ser mayor que cero y que los platos sin precio van en «Incluidos»

### Requirement: Platos incluidos
Un plato de la categoría «Incluidos» MUST NOT tener tamaños ni precios y MUST tener un texto, escrito por el dueño, que indique con qué compra se incluye. El sistema MUST rechazar guardarlo sin ese texto.

#### Scenario: El dueño crea un plato incluido
- **GIVEN** el dueño está creando el plato «Tapa del día»
- **WHEN** elige la categoría «Incluidos», escribe «Con cada bebida» como compra con la que se incluye, declara sus alérgenos y guarda
- **THEN** el sistema guarda el plato sin precio
- **AND** el comensal lo ve en «Incluidos» con el texto «Con cada bebida»

#### Scenario: El dueño intenta guardar un plato incluido sin indicar la compra
- **GIVEN** el dueño está creando un plato en «Incluidos»
- **WHEN** intenta guardarlo sin indicar con qué compra se incluye
- **THEN** el sistema no lo guarda
- **AND** le indica que ese dato es obligatorio

### Requirement: Declaración de alérgenos obligatoria
Cada plato MUST tener exactamente una de estas dos declaraciones: una lista con al menos uno de los 14 alérgenos del Reglamento (UE) 1169/2011, Anexo II, o la declaración explícita de que no contiene alérgenos de declaración obligatoria. El sistema MUST rechazar guardar un plato sin ninguna de las dos o con ambas.

#### Scenario: El dueño guarda un plato declarado sin alérgenos
- **GIVEN** el dueño está creando el plato «Agua mineral» con todos los datos obligatorios
- **WHEN** marca «No contiene alérgenos de declaración obligatoria» y guarda
- **THEN** el sistema guarda el plato con esa declaración

#### Scenario: El dueño intenta guardar un plato sin declaración de alérgenos
- **GIVEN** el dueño está creando el plato «Ensaladilla» con todos los demás datos obligatorios
- **WHEN** intenta guardarlo sin seleccionar ningún alérgeno y sin marcar que no contiene alérgenos
- **THEN** el sistema no guarda el plato
- **AND** le indica que debe declarar los alérgenos o marcar que no contiene ninguno

#### Scenario: El dueño no puede combinar alérgenos y «no contiene alérgenos»
- **GIVEN** el plato «Tostada» tiene declarado el alérgeno «Gluten»
- **WHEN** el dueño marca «No contiene alérgenos de declaración obligatoria»
- **THEN** el plato deja de tener alérgenos seleccionados, de modo que solo queda una declaración

### Requirement: Publicación inmediata
Todo cambio del catálogo que el dueño guarda MUST quedar publicado: el comensal lo ve al abrir o recargar la carta, sin ningún paso adicional de publicación.

#### Scenario: El dueño prepara un plato sin mostrarlo
- **GIVEN** el dueño quiere preparar el plato «Torrijas» antes de ofrecerlo
- **WHEN** lo crea y, a continuación, lo archiva
- **THEN** el comensal no ve «Torrijas» en la carta
- **AND** cuando el dueño lo reactiva, el comensal lo ve al abrir o recargar la carta

### Requirement: Archivado y reactivación
El dueño MUST poder archivar y reactivar platos y categorías (salvo «Incluidos», que no se archiva). El sistema MUST NOT ofrecer el borrado de platos ni de categorías: un elemento archivado se conserva con todos sus datos. Los elementos archivados MUST seguir visibles para el dueño, separados de los activos. Un elemento reactivado MUST volver a su posición anterior.

#### Scenario: El dueño archiva un plato y este se conserva
- **GIVEN** el plato «Croquetas» está activo
- **WHEN** el dueño archiva «Croquetas»
- **THEN** «Croquetas» deja de aparecer en la carta del comensal
- **AND** el dueño sigue viendo «Croquetas», marcado como archivado, con todos sus datos

#### Scenario: El dueño reactiva un plato archivado
- **GIVEN** en «Raciones» los platos activos eran «Patatas», «Croquetas», «Calamares» y el dueño archivó «Croquetas»
- **WHEN** el dueño reactiva «Croquetas»
- **THEN** «Croquetas» vuelve a aparecer en la carta del comensal entre «Patatas» y «Calamares»

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
La administración MUST poder usarse por completo desde la pantalla de un móvil, sin desplazamiento horizontal y con controles de al menos 44×44 CSS px. Sus textos de interfaz MUST estar disponibles en español e inglés, MUST mostrarse en español por defecto y la elección de idioma MUST recordarse en ese dispositivo.

#### Scenario: El dueño gestiona el catálogo desde su móvil
- **GIVEN** el dueño ha iniciado sesión desde un móvil con pantalla de 360 CSS px de ancho
- **WHEN** crea, edita, archiva y reordena platos y categorías
- **THEN** puede completar todas esas acciones sin desplazamiento horizontal
- **AND** todos los controles tienen un área táctil de al menos 44×44 CSS px

#### Scenario: El dueño usa la administración en inglés
- **GIVEN** el dueño abre la administración por primera vez en su móvil
- **WHEN** la administración se muestra
- **THEN** los textos de la interfaz están en español
- **WHEN** el dueño elige inglés
- **THEN** los textos de la interfaz pasan a inglés y siguen en inglés la próxima vez que abra la administración en ese móvil
