# no-tone Starter Template (Bun Edition)

## Core Stack

-   Bun (runtime, package manager)
-   Turborepo
-   Biome
-   Next.js (App Router + PWA)
-   Expo
-   Cloudflare Workers
-   Hono
-   Neon PostgreSQL
-   Drizzle ORM
-   Better Auth (Email/Password)
-   Cloudflare R2
-   Zod
-   TanStack Query
-   Vitest

## Accounts

-   Cloudflare
-   Neon
-   GitHub

## Install

-   Install Bun
-   Install Git
-   Install Node.js (required by some tooling)

``` bash
bun --version
```

## Repository Layout

``` text
no-tone/
├── apps/
│   ├── web/
│   ├── mobile/
│   └── api/
├── packages/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── types/
│   ├── ui/
│   └── validation/
├── biome.json
├── turbo.json
├── bun.lock
└── package.json
```

## Create Repository

``` bash
mkdir no-tone
cd no-tone

bunx create-turbo@latest .
```

## Create Apps

### Web

``` bash
bunx create-next-app@latest apps/web
```

Choose: - TypeScript - App Router - Tailwind CSS - Turbopack

### Mobile

``` bash
bunx create-expo-app apps/mobile
```

### API

``` bash
bun create cloudflare@latest apps/api
```

Choose: - Hono - TypeScript - Workers

## Install Dependencies

``` bash
bun add \
drizzle-orm \
@neondatabase/serverless \
better-auth \
hono \
zod \
@tanstack/react-query
```

Development:

``` bash
bun add -d \
drizzle-kit \
@biomejs/biome \
vitest \
typescript \
@types/node \
dotenv
```

## Database

-   Neon PostgreSQL
-   Drizzle ORM
-   Shared package: packages/db

## Authentication

Better Auth

Initial providers: - Email/password

Later: - Google - Apple - Passkeys

## Storage

Cloudflare R2

## API

-   Hono
-   Cloudflare Workers
-   https://api.no-tone.com

## Frontend

-   https://no-tone.com
-   PWA enabled

## Shared Packages

-   db
-   auth
-   validation
-   types
-   ui
-   config

## Environment

apps/web/.env.local

``` env
NEXT_PUBLIC_API_URL=https://api.no-tone.com
```

apps/api/.dev.vars

``` env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://api.no-tone.com
R2_BUCKET=
```

## Nice-to-have Later

-   Stripe
-   Resend
-   PostHog
-   Sentry
-   GitHub Actions
-   Rate limiting
-   Background jobs
-   Redis (only if required)

## Goal

Create a reusable starter template that can be cloned for future SaaS
projects with authentication, database, storage, web, mobile, and API
already configured.

---


# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo build
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo build
bun dlx turbo build
bun exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo build --filter=docs
```

Without global `turbo`:

```sh
npx turbo build --filter=docs
bun exec turbo build --filter=docs
bun exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo dev
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo dev
bun exec turbo dev
bun exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters):

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo dev --filter=web
```

Without global `turbo`:

```sh
npx turbo dev --filter=web
bun exec turbo dev --filter=web
bun exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed (recommended):

```sh
cd my-turborepo
turbo login
```

Without global `turbo`, use your package manager:

```sh
cd my-turborepo
npx turbo login
bun exec turbo login
bun exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

With [global `turbo`](https://turborepo.dev/docs/getting-started/installation#global-installation) installed:

```sh
turbo link
```

Without global `turbo`:

```sh
npx turbo link
bun exec turbo link
bun exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.dev/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.dev/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.dev/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.dev/docs/reference/configuration)
- [CLI Usage](https://turborepo.dev/docs/reference/command-line-reference)
