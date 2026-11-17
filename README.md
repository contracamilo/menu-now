# Menu-now

A digital menu with ordering for neighborhood cafés and bars.

The diner scans their table's code, browses the menu and orders from their phone; staff receive and manage the orders; the owner manages the menu and venue settings. No diner accounts, no payments, no hassle.

## Roles

| Role | What they do |
| --- | --- |
| **Owner** | Manages the menu and venue settings |
| **Staff** | Receives and manages orders |
| **Diner** | Browses the menu and places orders |

No role has a technical background: plain language, short flows and mobile-first design.

## Principles

- **Simplicity first.** This is an app for a neighborhood café, not a platform. Given two solutions, pick the simpler one.
- **Privacy by design.** The diner never registers or provides personal data. An order is tied to a table, never to a person.
- **The spec is the source of truth.** Every change to observable behavior goes through an OpenSpec change (proposal + deltas). Behavior not described in `openspec/specs/` is a defect, even if the code works.
- **Real accessibility.** Readable typography, high contrast and large buttons. Allergens are always shown visibly (legal requirement).

## Stack

- **Frontend:** React 19 + TypeScript + Vite (SPA), TanStack Query, SCSS
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Testing:** Vitest + React Testing Library (unit and integration), Playwright (cross-role e2e)
- **Languages:** Spanish (default) and English

## Deployment

One instance per venue: a frontend and its own Supabase project. The code is **not** multi-tenant and does not model multiple venues in a single database.

## Out of scope

- Payment gateways: the app does not process payments.
- Diner accounts or personal data.

## Spec-driven development (OpenSpec)

The project follows a spec-driven workflow with [OpenSpec](https://github.com/Fission-AI/OpenSpec):

```
openspec/
├── config.yaml        # Project context and per-artifact rules
├── specs/             # Living specs: the system's current behavior
└── changes/           # Changes in progress (proposal, design, deltas, tasks)
    └── archive/       # Applied and archived changes
```

Lifecycle of a change:

1. **Proposal** (`proposal.md`): what and why, affected roles and dated business decisions.
2. **Spec deltas**: requirements with a normative keyword (MUST/SHALL) and scenarios written from a role's perspective.
3. **Design**: technical decisions, migrations and RLS policies if the schema changes, user-facing text in es and en.
4. **Tasks**: every scenario covered by at least one test.
5. **Apply → Verify → Archive**: implement, verify against the spec and merge the deltas into `openspec/specs/`.
