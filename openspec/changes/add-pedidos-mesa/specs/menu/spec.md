# Spec Delta

## MODIFIED Requirements

### Requirement: Carta pública sin identificación
El sistema MUST permitir consultar la carta sin iniciar sesión, sin crear cuenta y sin pedir ningún dato personal al comensal. La carta MUST poder abrirse desde el QR de una mesa, con esa mesa identificada y su nombre visible en la parte superior, o desde la dirección general de la carta, sin mesa. El contenido de la carta MUST ser el mismo para todas las mesas y para la dirección general.

#### Scenario: El comensal abre la carta desde el QR
- **GIVEN** un comensal que no ha iniciado sesión
- **WHEN** el comensal abre la carta desde el QR de la mesa «Mesa 4»
- **THEN** el sistema muestra la carta completa con la mesa «Mesa 4» indicada en la parte superior
- **AND** no le pide identificarse, registrarse ni introducir ningún dato

#### Scenario: El comensal abre la carta desde la dirección general
- **GIVEN** un comensal que no ha iniciado sesión
- **WHEN** el comensal abre la dirección general de la carta, sin mesa
- **THEN** el sistema muestra la carta completa, sin ninguna mesa indicada
- **AND** no le pide identificarse, registrarse ni introducir ningún dato

#### Scenario: Todas las mesas ven la misma carta
- **GIVEN** los comensales de «Mesa 1» y «Terraza 2» abren la carta desde el QR de su mesa
- **WHEN** ambos ven la carta
- **THEN** ven las mismas categorías, platos, precios y alérgenos
