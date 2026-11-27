## ADDED Requirements

### Requirement: Longitud máxima del nombre del local
El sistema MUST rechazar un nombre de local de más de 60 caracteres. Mientras el dueño escribe el nombre en «Mi local», la administración MUST mostrar cuántos caracteres lleva de los 60 permitidos y MUST NOT admitir más.

#### Scenario: El dueño escribe un nombre de local largo
- **GIVEN** el dueño está en «Mi local»
- **WHEN** escribe un nombre de 60 caracteres e intenta seguir escribiendo
- **THEN** el nombre no admite más caracteres
- **AND** el dueño ve que lleva 60 de los 60 caracteres permitidos
