# venue-settings Specification

## Purpose

Los datos propios del local que edita el dueño desde la administración —su nombre y su logo— y que identifican el local en la carta del comensal y en la administración.

## Requirements

### Requirement: Nombre y logo del local
El dueño MUST poder editar el nombre del local y añadir, sustituir o quitar su logo desde la administración. El nombre es obligatorio para guardar estos datos; el logo es opcional. El logo MUST ser una imagen JPEG, PNG o WebP de hasta 5 MB; el sistema MUST rechazar cualquier otro archivo informando del motivo y sin perder el nombre introducido.

#### Scenario: El dueño pone el nombre y el logo de su local
- **GIVEN** el dueño ha iniciado sesión
- **WHEN** abre «Mi local», escribe «Bar Manolo», elige un logo PNG de 1 MB y guarda
- **THEN** el sistema guarda el nombre y el logo

#### Scenario: El dueño intenta guardar sin nombre
- **GIVEN** el dueño está en «Mi local»
- **WHEN** intenta guardar con el nombre vacío
- **THEN** el sistema no guarda los datos
- **AND** le indica que el nombre es obligatorio

#### Scenario: El dueño intenta subir un logo de más de 5 MB
- **GIVEN** el dueño está en «Mi local» y ha escrito el nombre «Bar Manolo»
- **WHEN** elige un logo de 8 MB
- **THEN** el sistema rechaza el logo
- **AND** le indica que el tamaño máximo es 5 MB
- **AND** conserva el nombre «Bar Manolo» en el formulario

### Requirement: Identidad del local en la carta y en la administración
La carta del comensal y la administración MUST mostrar en su cabecera el nombre del local y, si existe, su logo, con el nombre del local como texto alternativo. Si el dueño aún no ha guardado el nombre, la carta MUST mostrar como título el texto genérico de carta en el idioma de la interfaz.

#### Scenario: El comensal ve el nombre y el logo del local
- **GIVEN** el local se llama «Bar Manolo» y tiene logo
- **WHEN** el comensal abre la carta
- **THEN** ve en la cabecera el logo y el nombre «Bar Manolo»
- **AND** un lector de pantalla anuncia el logo como «Bar Manolo»

#### Scenario: El comensal ve un local sin logo
- **GIVEN** el local se llama «Bar Manolo» y no tiene logo
- **WHEN** el comensal abre la carta
- **THEN** ve en la cabecera solo el nombre «Bar Manolo», sin imagen rota ni hueco vacío

#### Scenario: El comensal ve la carta de un local sin nombre configurado
- **GIVEN** el dueño todavía no ha guardado el nombre del local
- **WHEN** el comensal abre la carta en inglés
- **THEN** ve como título «Menu»

#### Scenario: El dueño ve su local en la administración
- **GIVEN** el local se llama «Bar Manolo» y tiene logo
- **WHEN** el dueño abre la administración
- **THEN** ve en la cabecera el logo y el nombre «Bar Manolo»

### Requirement: Longitud máxima del nombre del local
El sistema MUST rechazar un nombre de local de más de 60 caracteres. Mientras el dueño escribe el nombre en «Mi local», la administración MUST mostrar cuántos caracteres lleva de los 60 permitidos y MUST NOT admitir más.

#### Scenario: El dueño escribe un nombre de local largo
- **GIVEN** el dueño está en «Mi local»
- **WHEN** escribe un nombre de 60 caracteres e intenta seguir escribiendo
- **THEN** el nombre no admite más caracteres
- **AND** el dueño ve que lleva 60 de los 60 caracteres permitidos
