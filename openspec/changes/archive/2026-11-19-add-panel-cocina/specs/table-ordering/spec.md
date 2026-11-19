# Spec Delta

## ADDED Requirements

### Requirement: Estado actual del pedido visto por el comensal
La confirmación de un pedido y «Mis pedidos» MUST mostrar al comensal el estado actual de cada pedido: «Recibido», «En preparación», «Servido» o «Cancelado». El estado MUST estar actualizado cada vez que el comensal abre esas pantallas o vuelve a ellas, sin que tenga que identificarse.

#### Scenario: El comensal comprueba si su pedido está en marcha
- **GIVEN** el comensal de «Mesa 4» confirmó el pedido 3 desde su móvil
- **AND** el personal ha pasado el pedido 3 a «En preparación»
- **WHEN** el comensal vuelve a «Mis pedidos» desde la carta de «Mesa 4»
- **THEN** ve el pedido 3 con el estado «En preparación»

#### Scenario: El comensal ve que su pedido se ha cancelado
- **GIVEN** el comensal de «Mesa 4» confirmó el pedido 8 desde su móvil
- **AND** el personal ha cancelado el pedido 8
- **WHEN** el comensal abre el detalle del pedido 8
- **THEN** ve el pedido 8 con el estado «Cancelado»
- **AND** ve un texto que le invita a preguntar al personal si tiene dudas
