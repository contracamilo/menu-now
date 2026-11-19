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
- **Languages:** Spanish and English (the diner menu defaults to English; owner and staff screens default to Spanish)

## Deployment

One instance per venue: a frontend and its own Supabase project. The code is **not** multi-tenant and does not model multiple venues in a single database.

## Local development

**Prerequisites:** Node.js 22+ and Docker (Docker Desktop or compatible) running.

```bash
npm install
npx playwright install chromium   # browser for e2e tests and Lighthouse
npm run db:start                  # local Supabase (Postgres, Auth, Storage, Mailpit)
cp .env.example .env.local        # then paste API_URL and ANON_KEY from `npx supabase status`
npm run db:reset                  # migrations + reference menu (supabase/seed.sql) + sample images
npm run dev                       # http://127.0.0.1:5173
```

- **Diner menu:** <http://127.0.0.1:5173/>
- **Admin:** <http://127.0.0.1:5173/admin>. Two development owner accounts come with the seed: `owner1@menu-now.test` and `owner2@menu-now.test`, password `menu-now-dev`.
- **Emails (password reset):** local Supabase does not send real emails; open Mailpit (formerly Inbucket) at <http://127.0.0.1:54324> to read them. The link opens `/admin/reset-password`.
- **Supabase Studio:** <http://127.0.0.1:54323>.

### Tests

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm test` | Screens and pure functions (Vitest + React Testing Library, fake Supabase client) | — |
| `npm run typecheck` | TypeScript, including that `en.ts` has every key of `es.ts` | — |
| `npm run db:test` | Database rules, RLS and RPCs (pgTAP) | `db:start` |
| `npm run test:int` | Auth (no sign-up, password reset email) and Storage limits | `db:start` |
| `npm run e2e` | Owner manages the menu → diner sees it (Playwright) | `db:start` + `db:reset` |
| `npm run perf` | Lighthouse CI: LCP < 2 s, `/` JS ≤ 150 KB gzip, accessibility = 1 | `db:start` + `db:reset` |

## Setting up a venue instance (manual steps)

Each venue gets its own Supabase project and its own frontend deployment. Repeat for every instance:

1. **Apply the migrations:** `npx supabase link --project-ref <ref>` and `npx supabase db push`. This creates the tables, RLS policies, functions, the «Incluidos» category, the venue settings row and the `images` bucket.
2. **Configure Supabase Auth** in the Dashboard:
   - turn off *Allow new users to sign up*;
   - minimum password length: **8**;
   - *Site URL* = the instance's public URL, and add `<URL>/admin/reset-password` to *Redirect URLs*;
   - set up **custom SMTP** (a transactional email provider) with a sender for the venue, and review the *Reset password* email template. Without SMTP the app works, but owners will not receive the reset link.
3. **Create each owner account** (repeat per owner): Dashboard → Authentication → *Add user* (email + password, *Auto confirm*), then in the SQL Editor:
   ```sql
   insert into public.backoffice_users (user_id, role)
   select id, 'owner' from auth.users where email = '<owner email>';
   ```
   To remove an owner, delete their user in Authentication (their row is removed in cascade).
4. **Deploy the frontend** with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the instance (`npm run build`, upload `dist/`). Configure the host's **SPA fallback**: every route serves `index.html`.
5. **Hand over:** ask the owner to fill in the venue name and logo in *Mi local*, and print the table QR codes pointing to the instance's root URL (the same for every table).

Create each Supabase project in the EU region closest to the venue.

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
