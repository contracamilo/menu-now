# Menu-now

Carta digital con pedidos para cafeterías y bares de barrio.

El comensal escanea el código de su mesa, consulta la carta y pide desde el móvil; el empleado recibe y gestiona los pedidos; el dueño configura la carta y el local. Sin registros de clientes, sin pagos, sin complicaciones.

## Roles

| Rol | Qué hace |
| --- | --- |
| **Dueño** | Configura la carta y el local |
| **Empleado** | Recibe y gestiona los pedidos |
| **Comensal** | Consulta la carta y pide |

Ningún rol tiene perfil técnico: lenguaje llano, flujos cortos y diseño mobile-first.

## Principios

- **Simplicidad ante todo.** Es una aplicación para una cafetería de barrio, no una plataforma. Entre dos soluciones, la más simple.
- **Privacidad por diseño.** El comensal nunca se registra ni aporta datos personales. Un pedido se asocia a una mesa, jamás a una persona.
- **La spec es la fuente de verdad.** Todo cambio de comportamiento observable entra como cambio de OpenSpec (propuesta + deltas). Un comportamiento que `openspec/specs/` no describe es un defecto, aunque el código funcione.
- **Accesibilidad real.** Tipografía legible, contraste alto y botones grandes. Los alérgenos se muestran siempre de forma visible (obligación legal).

## Stack

- **Frontend:** React 19 + TypeScript + Vite (SPA), TanStack Query, SCSS
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Testing:** Vitest + React Testing Library (unitarios e integración), Playwright (e2e entre roles)
- **Idiomas:** español (por defecto) e inglés

## Despliegue

Una instancia por local: un frontend y un proyecto de Supabase propio. El código **no** es multi-tenant y no modela varios locales en una misma base de datos.

## Fuera de alcance

- Pasarelas de pago: la app no procesa cobros.
- Cuentas o datos personales de comensales.

## Desarrollo guiado por specs (OpenSpec)

El proyecto sigue un flujo spec-driven con [OpenSpec](https://github.com/Fission-AI/OpenSpec):

```
openspec/
├── config.yaml        # Contexto del proyecto y reglas por artefacto
├── specs/             # Specs vivas: comportamiento actual del sistema
└── changes/           # Cambios en curso (propuesta, design, deltas, tasks)
    └── archive/       # Cambios ya aplicados y archivados
```

Flujo de un cambio:

1. **Propuesta** (`proposal.md`): qué y por qué, roles afectados y decisiones de negocio fechadas.
2. **Specs delta**: requisitos con palabra normativa (MUST/SHALL) y escenarios narrados desde un rol.
3. **Design**: decisiones técnicas, migraciones y políticas RLS si toca el esquema, textos en es y en.
4. **Tasks**: cada escenario cubierto por al menos un test.
5. **Apply → Verify → Archive**: implementar, verificar contra la spec y fusionar los deltas en `openspec/specs/`.
