# TaskFlow

**Stack:** Go · PostgreSQL · React · TypeScript · Tailwind CSS · Docker

---

## Running Locally

```bash
git clone https://github.com/catwhisperer27/taskflow-Rishi
cd taskflow
cp .env.example .env
docker compose up --build
```

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| API      | http://localhost:8080 |
| API Docs | http://localhost:8080/api/v1/* |

Migrations and seed data run automatically on first startup.

---

## Test Credentials

```
Email:    test@example.com
Password: password123

Email:    sam@example.com
Password: password123

```

---

## Some example emails and their uniqueids to add to project and assign tasks:

```
Name          Email                 UniqueIDs

Alice Chen    alice@example.com     alice
Bob Martinez  bob@example.com       bob
Sara Johnson  sara@example.com      sara

```

---

## Architecture Decisions

### Backend

**Go + chi** — standard library HTTP with chi for routing. chi uses `net/http` interfaces throughout so middleware is composable without framework-specific types.

**Split handler files** — one file per resource: `auth_handler.go`, `project_handler.go`, `task_handler.go`. Each is independently readable and testable. A base.go holds shared helpers.

**pgx directly, no ORM** — the schema is relational and predictable. Raw SQL is clearer than ORM magic for joins and partial updates.

**Partial updates via CASE, not COALESCE** — `COALESCE($1, field)` silently ignores `false` for booleans. For nullable fields like `is_shared` we use `CASE WHEN $1::boolean IS NOT NULL THEN $1 ELSE field END` to correctly handle explicit false values.

**Transactions** — project delete wraps task deletion + project deletion in a single transaction. A server crash between the two operations won't leave orphaned tasks.

**Rate limiting** — `golang.org/x/time/rate` per-IP limiter on `/auth/register` and `/auth/login`. 10 burst, refills 1 token every 12 seconds (~5/min sustained). Brute force resistance without Redis dependency.

**Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy` on every response.

**API versioning** — all routes under `/api/v1/`. Unversioned `/health` for infrastructure health checks.

**`is_shared` projects** — a project is visible to a user if they own it, it's shared with the team, or they have an assigned task in it. All checks happen in a single efficient SQL query using `EXISTS`. `PATCH` and `DELETE` still require ownership.

### Frontend

**React + TanStack Query** — all state is server state. TanStack Query handles caching, background refetch, and optimistic updates. No separate state store needed.

**Optimistic status updates** — task status changes update the UI immediately. The previous state is captured and restored on error.

**Sonner toasts** — lightweight toast library. Success/error feedback on every create, update, delete, and bulk action.

**Sidebar layout** — project list in the sidebar with shared badges. Dedicated "My Tasks" view showing all tasks assigned to the current user across all projects.

**Skeleton loaders** — shimmer placeholders on initial load instead of spinner-only states.

**No component library** — everything is Tailwind. Avoids bundle overhead and design constraints.

### What I Left Out and Why

**Refresh tokens** — 24-hour JWTs are appropriate scope. Production would need token rotation.

**JWT blacklist** — logout just clears client storage. A Redis-backed blacklist would prevent reuse of stolen tokens until expiry.

**Full-text search** — the search bar does client-side filtering. PostgreSQL `tsvector` would be the natural next step for server-side search across large datasets.

**Pagination** — `LIMIT/OFFSET` query structure is in place in `ListTasks`. Adding `?page=&limit=` params is a small extension.

**WebSockets** — SSE handles assignment notifications. Full bidirectional WebSockets would enable collaborative editing.

**Tests** — handler logic is isolated from routing, making integration tests with `testcontainers-go` straightforward to add.

---

## API Reference

Base: `http://localhost:8080/api/v1`

All protected endpoints: `Authorization: Bearer <token>`

### Auth (rate-limited: 5 req/min per IP)

```
POST /auth/register   { name, email, password }  → 201 { token, user }
POST /auth/login      { email, password }          → 200 { token, user }
GET  /auth/me                                      → 200 User
```

### Projects

```
GET    /projects              List projects (owned + shared + assigned)
POST   /projects              { name, description?, is_shared? }
GET    /projects/:id          Project + tasks
PATCH  /projects/:id          { name?, description?, is_shared? }  (owner only)
DELETE /projects/:id          Deletes project + tasks transactionally  (owner only)
GET    /projects/:id/stats    Task counts by status and assignee
```

### Tasks

```
GET    /projects/:id/tasks    List, supports ?status= and ?assignee=
POST   /projects/:id/tasks    { title, description?, priority?, assignee_id?, due_date? }
PATCH  /tasks/:id             Any field
DELETE /tasks/:id             Project owner only
POST   /tasks/bulk            { task_ids: string[], status }
GET    /tasks/my              All tasks assigned to current user
```

### Notifications

```
GET /notifications/stream    SSE stream. Pass token as ?token= query param.
                             Fires on task assignment.
```

### Error format

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
{ "error": "unauthorized" }
{ "error": "forbidden" }
{ "error": "not found" }
{ "error": "too many requests" }
```

---

## Running Migrations Manually

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Up
migrate -path backend/migrations \
  -database "postgres://taskflow:taskflow@localhost:5432/taskflow?sslmode=disable" up

# Down 1
migrate -path backend/migrations \
  -database "postgres://taskflow:taskflow@localhost:5432/taskflow?sslmode=disable" down 1
```

---

## Project Structure

```
taskflow/
├── backend/
│   ├── cmd/server/main.go           entry point, /api/v1 routes, graceful shutdown
│   ├── internal/
│   │   ├── auth/auth.go             bcrypt + JWT
│   │   ├── db/db.go                 pgxpool
│   │   ├── handlers/
│   │   │   ├── base.go              shared helpers, Handler struct
│   │   │   ├── auth_handler.go      register, login, me, users
│   │   │   ├── project_handler.go   CRUD + is_shared + stats
│   │   │   ├── task_handler.go      CRUD + bulk + my-tasks
│   │   │   └── sse.go               SSE notification broker
│   │   ├── middleware/
│   │   │   └── middleware.go        auth, logger, security headers, rate limit
│   │   └── models/models.go         plain structs
│   ├── migrations/
│   │   ├── 001_init.up.sql          schema, enums, indexes
│   │   ├── 001_init.down.sql
│   │   ├── 002_is_shared.up.sql     add is_shared to projects
│   │   ├── 002_is_shared.down.sql
│   │   └── seed.sql                 test users, project, tasks
│   ├── Dockerfile                   multi-stage, golang:1.24-alpine
│   └── migrate.sh                   wait-for-db + migrate + seed + start
├── frontend/
│   ├── src/
│   │   ├── lib/api.ts               axios + typed API (all /api/v1/ prefixed)
│   │   ├── contexts/AuthContext.tsx
│   │   ├── hooks/useNotifications.ts SSE hook
│   │   ├── components/
│   │   │   ├── ui.tsx               Input, Modal, Badge, Skeleton, Tooltip
│   │   │   ├── Navbar.tsx           (unused — replaced by sidebar)
│   │   │   ├── TaskForm.tsx         create/edit with toast feedback
│   │   │   └── Toast.tsx            inline toast component
│   │   └── pages/
│   │       ├── AuthPage.tsx         login + register
│   │       ├── ProjectsPage.tsx     list + search + is_shared toggle
│   │       ├── ProjectPage.tsx      list + board + bulk select + filter chips + search
│   │       └── MyTasksPage.tsx      assigned-to-me across all projects
│   ├── Dockerfile                   multi-stage nginx
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## What I'd Do With More Time

**JWT blacklist on logout** — Redis-backed set of revoked JTIs. Small Redis instance, big security win.

**`testcontainers-go` integration tests** — spin up a real PostgreSQL, run migrations, test the full request/response cycle for auth and task CRUD.

**Pagination** — `?page=&limit=` on list endpoints with `X-Total-Count` response header.

**Assignee display** — currently shows an icon. Would fetch and display the user's name in the row and as a tooltip quick-reassign popover.

**Drag-and-drop** — the board view uses manual column rendering. `@dnd-kit/core` would add drag-between-columns with the optimistic update pattern already in place.

**Activity log** — `task_events` table recording status changes and assignments. Foundation for audit trail and "recently updated" views.

**OpenAPI/Swagger** — `swaggo` annotations on handlers to generate interactive docs at `/swagger/index.html`.
