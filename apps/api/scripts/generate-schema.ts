// Prints the D1 schema SQL for a fresh (empty) `tonil-auth` database to
// stdout — regenerate with `bun run scripts/generate-schema.ts > db/schema.sql`
// whenever packages/auth's plugins/options change.
//
// `@better-auth/cli`'s published `generate` command (as of 1.4.21) predates
// D1 support in better-auth's kysely adapter and can't detect a D1 database
// at all, so this calls the same migration-diffing function
// (`better-auth/db/migration`) directly instead. It needs a database object
// duck-typed as D1 (`prepare`/`exec`/`batch`); a real D1Database only exists
// inside a Workers runtime, so this stub reports an empty database — correct
// for a bootstrap, but this script won't detect drift against a non-empty
// database, only produce the from-scratch schema.
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";

function emptyResult() {
  return { results: [], meta: {} };
}

const stubD1 = {
  prepare(_sql: string) {
    const bound = {
      bind: (..._args: unknown[]) => bound,
      all: async () => emptyResult(),
      run: async () => emptyResult(),
      first: async () => null,
    };
    return bound;
  },
  async exec(_sql: string) {
    return { count: 0, duration: 0 };
  },
  async batch(statements: unknown[]) {
    return statements.map(() => emptyResult());
  },
} as unknown as D1Database;

const options: BetterAuthOptions = {
  database: stubD1,
  secret: "schema-generation-placeholder",
  emailAndPassword: { enabled: true },
};

const { compileMigrations } = await getMigrations(options);
console.log(await compileMigrations());
