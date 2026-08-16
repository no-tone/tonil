# Engineering standards

Technical conventions for this monorepo. For the visual/brand philosophy, see [constitution.md](./constitution.md). For how the apps and packages fit together, see [architecture.md](./architecture.md). For deploying to Cloudflare, see [deployment.md](./deployment.md).

---

# Performance

Optimize by default.

Avoid unnecessary:

- Dependencies
- Re-renders
- Animations
- Network requests
- Abstractions

Measure before optimizing.

---

# Language

Use:

- TypeScript only
- Strict mode enabled

Avoid:

any

Prefer:

- Explicit types
- Composition
- Small focused files
- Small components

---

# Validation

Use:

- Zod (`packages/validation`)

Never trust:

- Client input
- External data
- API payloads

Validate at system boundaries — `apps/api`'s routes, not deeper.

---

# Database

No relational database beyond Cloudflare D1's use as Better Auth's storage, for now — no Neon/Postgres, no ORM. Revisit only when there's an actual feature that needs one; don't add one speculatively.

---

# API

Use:

- Hono (`apps/api`)
- RFC 7807 (`application/problem+json`) for every error response — see `packages/hono-middleware`'s `problemJson()`
- RFC 9727 (`/.well-known/api-catalog`) to advertise routes

Prefer REST conventions.

Examples:

```
GET /projects
GET /status
POST /csp-report
GET /info/:slug
```

Routes should be predictable and consistent.

---

# Project Structure

Preferred:

```
apps/
packages/
```

Shared logic belongs inside packages. Never duplicate business logic — if the same thing needs doing in `apps/web` and `apps/dashboard` (or any other pair), it belongs in a package, not copy-pasted.

---

# Git Guidelines

Commits should be:

- Small
- Focused
- Meaningful

Never commit:

- Secrets
- API keys
- Environment credentials

---

# Decision Framework

When uncertain:

Prefer:

- Less UI
- Less complexity
- Fewer dependencies
- Clearer interactions
- Better defaults

Avoid:

- Feature creep
- Decorative complexity
- Trend-driven design
