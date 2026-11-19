# Spec Delta: menu

## Purpose

La carta pública que consulta el comensal desde su móvil al escanear el QR de su mesa: qué platos y categorías se muestran, en qué orden, cómo se presentan tamaños, precios y alérgenos, y con qué garantías de idioma, rendimiento y accesibilidad.

## ADDED Requirements

### Requirement: Carta pública sin identificación
El sistema MUST permitir consultar la carta sin iniciar sesión, sin crear cuenta y sin pedir ningún dato personal al comensal. La carta MUST ser la misma para todas las mesas.

#### Scenario: El comensal abre la carta desde el QR
- **GIVEN** un comensal que no ha iniciado sesión
- **WHEN** el comensal abre la dirección de la carta desde el QR de cualquier mesa
- **THEN** el sistema muestra la carta completa
- **AND** no le pide identificarse, registrarse ni introducir ningún dato

### Requirement: Categorías en el orden del dueño
La carta MUST mostrar las categorías en el orden definido por el dueño y, dentro de cada categoría, los platos en el orden manual definido por el dueño.

#### Scenario: El comensal ve el orden decidido por el dueño
- **GIVEN** el dueño ha ordenado las categorías como «Desayunos», «Bocadillos», «Bebidas»
- **AND** dentro de «Bocadillos» ha ordenado los platos como «Calamares», «Lomo», «Tortilla»
- **WHEN** el comensal abre la carta
- **THEN** ve las categorías en ese mismo orden
- **AND** ve los platos de «Bocadillos» en ese mismo orden

### Requirement: Índice de categorías
La carta MUST mostrar en su parte superior un índice con las categorías visibles, en el mismo orden que la carta. Al elegir una categoría del índice, la carta MUST llevar al comensal a esa categoría.

#### Scenario: El comensal salta a una categoría desde el índice
- **GIVEN** la carta tiene visibles las categorías «Desayunos», «Bocadillos» y «Bebidas»
- **WHEN** el comensal abre la carta
- **THEN** ve arriba un índice con «Desayunos», «Bocadillos» y «Bebidas»
- **WHEN** toca «Bebidas» en el índice
- **THEN** la carta le lleva al comienzo de la categoría «Bebidas»

### Requirement: Solo platos activos
La carta MUST mostrar todos los platos activos de cada categoría visible y MUST NOT mostrar nunca un plato archivado. Un plato activo es un plato que el dueño no ha archivado.

#### Scenario: Un plato archivado desaparece de la carta
- **GIVEN** el plato «Croquetas» está activo y aparece en la carta
- **WHEN** el dueño archiva «Croquetas»
- **AND** el comensal abre o recarga la carta
- **THEN** el comensal no ve «Croquetas» en ninguna categoría
- **AND** el resto de platos activos de la categoría siguen apareciendo

### Requirement: Categorías visibles
La carta MUST NOT mostrar una categoría archivada ni una categoría sin platos activos, incluida la categoría «Incluidos». Los platos de una categoría archivada MUST NOT mostrarse aunque estén activos.

#### Scenario: Una categoría se queda sin platos activos
- **GIVEN** la categoría «Postres» tiene un único plato activo, «Flan»
- **WHEN** el dueño archiva «Flan»
- **AND** el comensal abre o recarga la carta
- **THEN** el comensal no ve la categoría «Postres» ni en la carta ni en el índice

#### Scenario: Una categoría archivada oculta sus platos
- **GIVEN** la categoría «Raciones» tiene platos activos
- **WHEN** el dueño archiva la categoría «Raciones»
- **AND** el comensal abre o recarga la carta
- **THEN** el comensal no ve la categoría «Raciones» ni ninguno de sus platos

### Requirement: Información de cada plato
Para cada plato, la carta MUST mostrar su nombre, sus precios (ver «Tamaños y precios»), su descripción corta si la tiene, su foto si la tiene y su declaración de alérgenos. El contenido escrito por el dueño MUST mostrarse tal cual, sin traducir.

#### Scenario: El comensal ve un plato con foto
- **GIVEN** el plato «Tostada con tomate», 2,50 €, descripción «Pan de pueblo, tomate rallado y AOVE», con foto y alérgeno «Gluten»
- **WHEN** el comensal abre la carta
- **THEN** ve el nombre, el precio «2,50 €», la descripción, la foto y el alérgeno «Gluten» del plato

#### Scenario: El comensal ve un plato sin foto
- **GIVEN** el plato «Café con leche» no tiene foto
- **WHEN** el comensal abre la carta
- **THEN** ve el nombre, el precio, la descripción y los alérgenos de «Café con leche»
- **AND** no ve ninguna imagen rota ni un hueco vacío en lugar de la foto

#### Scenario: El comensal ve un plato sin descripción
- **GIVEN** el plato «Caña» no tiene descripción
- **WHEN** el comensal abre la carta
- **THEN** ve el nombre, el precio y los alérgenos de «Caña»
- **AND** no ve ningún texto ni hueco vacío en lugar de la descripción

#### Scenario: El contenido del dueño no se traduce
- **GIVEN** el plato «Pincho de tortilla» con descripción «Con cebolla»
- **WHEN** el comensal cambia la interfaz de inglés a español o de español a inglés
- **THEN** sigue viendo «Pincho de tortilla» y «Con cebolla» tal como los escribió el dueño

### Requirement: Tamaños y precios
Para un plato con un solo tamaño, la carta MUST mostrar su precio en euros con IVA incluido y, si el dueño le dio nombre, el nombre del tamaño. Para un plato con varios tamaños, MUST mostrar cada tamaño con su nombre y su precio, en el orden del dueño. La carta MUST NOT mostrar nunca un precio de 0 €.

#### Scenario: El comensal ve un plato con varios tamaños
- **GIVEN** el plato «Croquetas» tiene los tamaños «Una» a 1,50 €, «Ración» a 7,00 € y «Plato» a 12,00 €, en ese orden
- **WHEN** el comensal abre la carta
- **THEN** ve junto a «Croquetas» los tres tamaños con sus precios en ese orden, sin realizar ninguna acción

#### Scenario: El comensal ve un plato con un solo precio
- **GIVEN** el plato «Caña» tiene un único tamaño sin nombre a 1,80 €
- **WHEN** el comensal abre la carta
- **THEN** ve «1,80 €» junto a «Caña», sin ningún nombre de tamaño

### Requirement: Platos incluidos
La carta MUST mostrar la categoría «Incluidos» con su nombre en el idioma de la interfaz. Para cada plato de «Incluidos», MUST mostrar, en lugar del precio, el texto del dueño que indica con qué compra se incluye.

#### Scenario: El comensal ve un plato incluido
- **GIVEN** el plato «Tapa del día» está en «Incluidos» con el texto «Con cada bebida»
- **WHEN** el comensal abre la carta
- **THEN** ve la categoría «Incluidos» (o «Included» si la interfaz está en inglés) con «Tapa del día» y el texto «Con cada bebida»
- **AND** no ve ningún precio en ese plato

### Requirement: Alérgenos siempre visibles
La carta MUST mostrar la declaración de alérgenos junto a cada plato del listado, como texto legible y sin requerir ninguna interacción (tocar, desplegar o pasar el dedo). Los alérgenos MUST ser los 14 del Reglamento (UE) 1169/2011, Anexo II.

#### Scenario: El comensal ve los alérgenos de un plato sin tocar nada
- **GIVEN** el plato «Calamares» declara los alérgenos «Gluten», «Moluscos» y «Huevos»
- **WHEN** el comensal abre la carta
- **THEN** ve «Gluten», «Moluscos» y «Huevos» junto a «Calamares» en el listado, sin realizar ninguna acción

#### Scenario: El comensal ve un plato declarado sin alérgenos
- **GIVEN** el plato «Agua mineral» está declarado explícitamente sin alérgenos
- **WHEN** el comensal abre la carta
- **THEN** ve el texto «No contiene alérgenos de declaración obligatoria» junto a «Agua mineral»

### Requirement: Aviso de alergias
La carta MUST mostrar, de forma fija y visible sin interacción, el aviso «Si tienes alguna alergia o intolerancia, consulta al personal» en el idioma de la interfaz. El comensal MUST NOT poder cerrarlo.

#### Scenario: El comensal ve el aviso de alergias
- **GIVEN** la carta tiene platos activos
- **WHEN** el comensal abre la carta
- **THEN** ve en la parte superior el aviso para consultar al personal en caso de alergia o intolerancia
- **AND** no hay ninguna opción para ocultarlo

### Requirement: Carta sin platos activos
Cuando no hay ningún plato activo visible, la carta MUST mostrar un mensaje que indique al comensal que la carta todavía no está disponible, en lugar de una pantalla vacía o un error.

#### Scenario: Primer arranque sin platos
- **GIVEN** el dueño todavía no ha creado ningún plato activo
- **WHEN** el comensal abre la carta
- **THEN** ve un mensaje que indica que la carta todavía no está disponible
- **AND** no ve ninguna categoría ni índice

### Requirement: Error al cargar la carta
Si la carta no se puede cargar (por ejemplo, por falta de conexión), el sistema MUST mostrar al comensal un mensaje que lo explique y una acción para reintentar, en lugar de una pantalla vacía.

#### Scenario: El comensal abre la carta sin conexión
- **GIVEN** el móvil del comensal no consigue obtener la carta
- **WHEN** el comensal abre la carta
- **THEN** ve un mensaje que indica que no se ha podido cargar la carta y un botón para reintentar
- **WHEN** recupera la conexión y pulsa reintentar
- **THEN** ve la carta

### Requirement: Idioma de la interfaz de la carta
Los textos de la interfaz de la carta MUST estar disponibles en inglés y español. La carta MUST mostrarse en inglés por defecto; el comensal MUST poder cambiar a español y volver a inglés desde la propia carta, y la elección MUST recordarse en ese dispositivo.

#### Scenario: El comensal cambia la interfaz a español
- **GIVEN** un comensal que abre la carta por primera vez en su móvil
- **WHEN** la carta se muestra
- **THEN** los textos de la interfaz están en inglés
- **WHEN** el comensal elige español
- **THEN** los textos de la interfaz (incluidos los nombres de los alérgenos, el aviso, los mensajes y el nombre de «Incluidos») pasan a español
- **AND** si el comensal vuelve a abrir la carta en el mismo móvil, se muestra en español

### Requirement: Rendimiento de la carta
La carta MUST cargar en menos de 2 segundos en un móvil de gama media con conexión 4G, medida en las condiciones de referencia que fija el design de este cambio.

#### Scenario: La carta carga a tiempo en condiciones de referencia
- **GIVEN** una carta de referencia y las condiciones de medición del design
- **WHEN** un comensal abre la carta en esas condiciones
- **THEN** el contenido principal de la carta es visible en menos de 2 segundos

### Requirement: Accesibilidad de la carta
La carta del comensal MUST cumplir WCAG 2.2 nivel AA y, además, MUST ofrecer un contraste de texto de al menos 7:1 y objetivos táctiles de al menos 44×44 CSS px.

#### Scenario: El comensal usa la carta con lector de pantalla
- **GIVEN** un comensal que usa un lector de pantalla
- **WHEN** recorre la carta
- **THEN** oye el índice como navegación, el nombre de cada categoría como encabezado y, para cada plato, su nombre, sus tamaños y precios (o con qué compra se incluye), su descripción si la tiene y sus alérgenos

#### Scenario: El comensal lee y toca la carta a pleno sol
- **GIVEN** un comensal que usa la carta en su móvil
- **WHEN** lee cualquier texto de la carta o toca cualquier control (por ejemplo, el selector de idioma o un enlace del índice)
- **THEN** todo texto tiene un contraste de al menos 7:1 con su fondo
- **AND** todo control tiene un área táctil de al menos 44×44 CSS px
