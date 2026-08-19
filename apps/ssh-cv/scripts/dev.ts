/* One command that gets you a real session: `bun run dev`.
 *
 * The server itself needs three things before it is worth looking at, and
 * none of them are interesting enough to make somebody do by hand every time:
 *
 *   - a host key, or it generates one relative to the working directory and
 *     your client warns about a changed identity the next time you run it
 *     from somewhere else;
 *   - an allowlist, or every session is an unauthorized one and the dotfiles
 *     pane - half the app - never appears;
 *   - something for that pane to browse.
 *
 * So this makes all three under .dev/ (gitignored, throwaway) if they are not
 * already there, starts the server, and prints the exact line to paste into
 * another terminal. Nothing here is used in production; see README.md for
 * what a real deployment passes instead.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const devDir = join(appRoot, ".dev");
const hostKey = join(devDir, "host_ed25519");
const clientKey = join(devDir, "id_ed25519");
const authorizedKeys = join(devDir, "authorized_keys");
const sampleDotfiles = join(devDir, "dotfiles");
const ADDR = "localhost:2222";

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

/**
 * A client key whose comment is the allowlist entry.
 *
 * `authz.ParseAuthorizedKeys` reads scopes from the trailing fields of the
 * comment, so `-C "laptop dotfiles"` is what grants the dotfiles scope - the
 * same shape a real key takes, which is the point of using it here rather
 * than hand-writing a fingerprint line.
 */
async function ensureKeys(): Promise<void> {
  if (!existsSync(hostKey)) {
    await run("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-C",
      "ssh-cv dev host",
      "-f",
      hostKey,
    ]);
  }
  if (!existsSync(clientKey)) {
    await run("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-C",
      "laptop dotfiles",
      "-f",
      clientKey,
    ]);
    await Bun.write(authorizedKeys, await Bun.file(`${clientKey}.pub`).text());
  }
}

/**
 * A few files to browse, unless you point DOTFILES_DIR at your own.
 *
 * `id_ed25519` is in here on purpose: the reader refuses to open anything
 * whose name matches a credential pattern, and a demo where you can see that
 * refusal is worth more than one where the feature is only described in a
 * README.
 */
async function ensureSampleDotfiles(): Promise<string> {
  const declared = process.env.DOTFILES_DIR?.trim();
  if (declared) return declared;

  if (!existsSync(sampleDotfiles)) {
    await mkdir(sampleDotfiles, { recursive: true });
    await writeFile(
      join(sampleDotfiles, ".zshrc"),
      'export EDITOR=nvim\nalias ll="ls -la"\n',
    );
    await writeFile(
      join(sampleDotfiles, ".tmux.conf"),
      "set -g mouse on\nset -g base-index 1\n",
    );
    await writeFile(
      join(sampleDotfiles, ".gitconfig"),
      "[init]\n\tdefaultBranch = main\n[pull]\n\trebase = true\n",
    );
    await writeFile(
      join(sampleDotfiles, "id_ed25519"),
      "not a real key - this file exists to show that it is listed and refused\n",
    );
  }
  return sampleDotfiles;
}

await mkdir(devDir, { recursive: true });
await ensureKeys();
const dotfiles = await ensureSampleDotfiles();

console.log("");
console.log("  ssh-cv is starting. In another terminal:");
console.log("");
console.log(`    ssh -p 2222 -i ${clientKey} localhost`);
console.log("");
console.log("  That key is allowlisted, so you get the dotfiles pane. To see");
console.log("  what everyone else sees, connect with any other key:");
console.log("");
console.log("    ssh -p 2222 -o IdentitiesOnly=yes localhost");
console.log("");

await run("go", [
  "run",
  ".",
  "--addr",
  ADDR,
  "--host-key",
  hostKey,
  "--authorized-keys",
  authorizedKeys,
  "--dotfiles",
  dotfiles,
]);
