/* Generates apps/ssh-cv/content/cv.json from @repo/content.

   The Go binary embeds the result with go:embed, so the SSH CV and the
   website are rendering the same words by construction rather than by
   somebody remembering to update both. Run it via `bun run build` in this
   app; CI runs it too, and the generated file is committed so a plain
   `go build` in a checkout without Bun still works. */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BEST_AT,
  type CvLang,
  EDUCATION,
  EXPERIENCE,
  INTERESTS,
  SKILLS,
  SPOKEN,
} from "@repo/content";

const LANGS: CvLang[] = ["en", "pt"];

const payload = {
  // A note for anyone who opens the generated file wondering where to edit.
  $comment:
    "Generated from packages/content/src/cv.ts - do not edit. Run `bun run build` in apps/ssh-cv.",
  langs: LANGS,
  byLang: Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      {
        bestAt: BEST_AT[lang],
        experience: EXPERIENCE[lang],
        education: EDUCATION[lang],
        skills: SKILLS[lang],
        spoken: SPOKEN[lang],
        interests: INTERESTS[lang],
      },
    ]),
  ),
};

const outPath = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "internal",
  "cv",
  "cv.json",
);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`wrote ${outPath}`);
