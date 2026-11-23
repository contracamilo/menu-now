## ADDED Requirements

### Requirement: Longitud máxima del nombre de una mesa
El sistema MUST rechazar un nombre de mesa de más de 20 caracteres. Mientras el dueño escribe el nombre, la administración MUST mostrar cuántos caracteres lleva de los 20 permitidos y MUST NOT admitir más.

#### Scenario: El dueño escribe un nombre de mesa largo
- **GIVEN** el dueño está creando una mesa
- **WHEN** escribe un nombre de 20 caracteres e intenta seguir escribiendo
- **THEN** el nombre no admite más caracteres
- **AND** el dueño ve que lleva 20 de los 20 caracteres permitidos
