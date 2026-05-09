# svbkmonorepo

Monorepo for the SVBK school fee management platform.

## Layout

```
.
├── apps/
│   ├── api/        @svbk/api          NestJS — single API for school admin + parents (port 3001)
│   ├── admin/      @svbk/admin        Next.js — admin web portal                     (port 3001 in dev — adjust if it clashes)
│   ├── parent/     @svbk/parent       Next.js — parent web portal                    (port 3002)
│   └── students/   @svbk/students     Next.js — students web portal (placeholder)    (port 3003)
├── mobile/
│   ├── admin/      @svbk/mobile-admin     Expo — admin mobile app
│   ├── parent/     @svbk/mobile-parent    Expo — parent mobile app
│   └── students/   @svbk/mobile-students  Expo — students mobile app
├── packages/                          shared libraries (types, ui, etc.) — empty for now
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## API design

`apps/api` is the **single backend** for the entire platform. It contains:

| Audience | Auth | Routes |
|---|---|---|
| Super-admin | password (`/api/auth/signin`) | tenants, tenant-configs, tenant-admins |
| Tenant admin | password (`/api/auth/signin`) | students, fees, payments, announcements, parents, … (per-tenant) |
| Parent | OTP (`/api/parent/auth/send-otp` → `/verify-otp`) | `/api/parent/me`, `/api/parent/students`, `/api/parent/dashboard`, `/api/parent/fees`, `/api/parent/payments` |

All data is **multi-tenant**: every entity carries `tenant_id`. JWT payload includes `role` + `tenantId`, and services filter by it.

Parents are linked to children by **admission number** (the canonical identity that doesn't change year-over-year). The current-year `Student` row is resolved via `(tenant_id, branch, admission_number, current academic_year)`.

See `apps/api/.env.example` for required env vars.

## Tooling

- **pnpm workspaces** for dependency management
- **Turborepo** for task orchestration and caching
- **Node 20** (see `.nvmrc`)

## Getting started

```bash
npm install -g pnpm     # if you don't have pnpm
pnpm install            # install all workspace deps
cp apps/api/.env.example apps/api/.env   # then edit DB_*, JWT secrets

pnpm dev                # run all dev servers in parallel
pnpm build              # build everything
```

### Run a single workspace

```bash
pnpm --filter @svbk/api dev
pnpm --filter @svbk/admin dev
pnpm --filter @svbk/parent dev
pnpm --filter @svbk/students dev
pnpm --filter @svbk/mobile-parent dev   # Expo
```

## Common scripts (root)

| Script | What it does |
|---|---|
| `pnpm dev` | Run `dev` in every workspace that has it |
| `pnpm build` | Build everything |
| `pnpm lint` | Lint everything |
| `pnpm test` | Test everything |
| `pnpm typecheck` | TypeScript check across all workspaces |
| `pnpm clean` | Remove build outputs and root `node_modules` |

## Environment files

Each app keeps its own `.env`. Real `.env` files are gitignored — commit
only `.env.example` files.

## Sharing code between apps

Drop a folder under `packages/` (e.g. `packages/types`) with its own
`package.json` named `@svbk/types`. Reference from any app:

```json
{ "dependencies": { "@svbk/types": "workspace:*" } }
```

Then `pnpm install`.
