## MODIFIED Requirements

### Requirement: Volver al inicio de la carta
Cuando el comensal se ha desplazado hacia abajo por la carta más de una pantalla, el sistema MUST mostrar un botón fijo, siempre visible, para volver al inicio de la carta. Mientras el comensal esté a menos de una pantalla del principio de la carta, el botón MUST NOT mostrarse.

#### Scenario: El comensal vuelve arriba tras elegir una categoría
- **GIVEN** el comensal ha elegido «Bebidas» en el índice y la carta le ha llevado a esa categoría, a más de una pantalla del principio
- **WHEN** toca el botón para volver arriba
- **THEN** la carta le lleva a su inicio, donde están el nombre del local, el aviso de alergias y el índice
- **AND** el botón deja de mostrarse

#### Scenario: El comensal abre la carta
- **GIVEN** un comensal que abre la carta
- **WHEN** todavía no se ha desplazado hacia abajo
- **THEN** no ve el botón para volver arriba

#### Scenario: El comensal baja menos de una pantalla
- **GIVEN** un comensal en el principio de la carta
- **WHEN** se desplaza hacia abajo menos de una pantalla
- **THEN** no ve el botón para volver arriba
