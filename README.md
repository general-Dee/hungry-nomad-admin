# Hungry Nomad Admin

Admin panel for Hungry Nomad, a food-delivery product. Built with Next.js
(App Router) and Supabase.

## Features

- **Dashboard** — today's revenue, order counts, and a sales chart, with
  realtime updates as new orders come in.
- **Orders** — view and search incoming orders.
- **Menu** — manage categories, subcategories, and items, with realtime sync.
- **Delivery areas** — manage per-LGA delivery fees and zones.
- **Admin invites** — invite-only admin onboarding: invite links are sent via
  [Resend](https://resend.com) (not Supabase's built-in mailer) so delivery,
  bounce, and complaint status can be tracked via webhooks.

## Tech stack

- [Next.js 14](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth, Realtime, Storage
- [Tailwind CSS](https://tailwindcss.com)
- [Recharts](https://recharts.org) for the dashboard's sales chart
- [Resend](https://resend.com) + [svix](https://www.svix.com) for invite
  emails and verified delivery-status webhooks
- [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com)
  for tests

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in real values (see
   [Environment variables](#environment-variables) below):
   ```bash
   cp .env.example .env.local
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000/admin](http://localhost:3000/admin).

## Environment variables

All required variables are listed (names only, no real values) in
`.env.example` — each has a comment explaining where to find it. A
`prebuild` script (`scripts/check-env.js`) reads that file and fails the
build loudly if any of these are missing from the environment, local or in
CI/Vercel:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public; access is enforced by RLS, not by keeping this secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, bypasses RLS — never expose to the client |
| `RESEND_API_KEY` | Sends admin-invite emails |
| `RESEND_FROM_EMAIL` | Sender identity; must use a domain verified in Resend |
| `RESEND_WEBHOOK_SECRET` | Verifies Resend delivery-status webhook signatures (via svix) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs the env check first, then `next build`) |
| `npm start` | Start the production server (after `build`) |
| `npm run lint` | ESLint (`next lint`) |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Testing

Tests live next to the code they cover (`*.test.ts(x)`), using Vitest with a
`node` environment by default and a per-file `// @vitest-environment jsdom`
override for the one component test. Supabase, Resend, and svix are mocked
rather than hit for real — see `src/test/mocks/` and the `vi.mock(...)` calls
at the top of each test file for the patterns used.

## Continuous integration

`.github/workflows/ci.yml` runs lint, tests, and a production build on every
push and pull request to `main`.

## Database migrations

Schema changes are tracked as timestamped `.sql` files in
`supabase/migrations/`, applied manually via the Supabase Dashboard's SQL
Editor (there's no Supabase CLI wired up in this project). See
[`supabase/migrations/README.md`](supabase/migrations/README.md) for the
naming convention and workflow.

## Project structure

```
src/
  app/
    admin/            # Dashboard, orders, menu, delivery-areas, invites, accept-invite
    api/
      admin/invite/    # Creates + emails admin invites
      webhooks/resend/ # Resend delivery-status webhook (svix-verified)
  components/          # Sidebar, ErrorBoundary, dashboard widgets
  context/             # Auth + Toast React contexts
  lib/                 # Supabase client helpers (browser + service-role)
  test/                # Vitest setup + shared mocks
middleware.ts           # Gates /admin/{orders,menu,delivery-areas,invites} on an authenticated session
supabase/migrations/    # Versioned schema changes (see README.md there)
```

## Deployment

Deploys on [Vercel](https://vercel.com). Set all variables from
[Environment variables](#environment-variables) in the project's Vercel
settings — the build will fail fast if any are missing.
