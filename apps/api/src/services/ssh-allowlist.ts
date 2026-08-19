/**
 * The SSH key allowlist: which key fingerprints may see what.
 *
 * Lives in a Worker secret rather than in apps/ssh-cv so access can be
 * granted or revoked by editing one value, with no rebuild of the Go binary
 * and no shell on the host that serves SSH. The SSH server asks this API on
 * each new key and caches the answer briefly.
 *
 * Format is one key per line, deliberately the same shape as the comment
 * field of an `authorized_keys` entry so the two can be kept in step by eye:
 *
 *     SHA256:AbCd… laptop dotfiles
 *     SHA256:EfGh… phone
 *     # comments and blank lines are ignored
 *
 * The first field is the fingerprint, the second a human label, and anything
 * after that is a scope. A line with no scopes is a recognised key that has
 * been granted nothing, which is a useful way to name a key without giving it
 * access.
 */

export interface KeyGrant {
  /** Human name for the key, shown in the SSH UI. Never a security decision. */
  label: string;
  scopes: string[];
}

const FINGERPRINT_PATTERN = /^SHA256:[A-Za-z0-9+/]{43}$/;

/**
 * Parse the allowlist secret.
 *
 * Malformed lines are skipped rather than throwing: a typo in one entry
 * should cost that one key its access, not take the endpoint down and lock
 * everybody out.
 */
export function parseAllowlist(raw: string | undefined): Map<string, KeyGrant> {
  const grants = new Map<string, KeyGrant>();
  if (!raw) return grants;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [fingerprint, label, ...scopes] = trimmed.split(/\s+/);
    if (!fingerprint || !FINGERPRINT_PATTERN.test(fingerprint)) continue;

    grants.set(fingerprint, {
      label: label ?? "",
      scopes: scopes.filter(Boolean),
    });
  }
  return grants;
}

/**
 * Compare two secrets in time independent of how much of them matches.
 *
 * `a === b` on strings short-circuits at the first differing character, which
 * over enough requests leaks the prefix. Comparing digests instead means
 * every comparison does the same work regardless of the inputs, and also
 * makes length differences harmless.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(digestA);
  const viewB = new Uint8Array(digestB);
  let difference = 0;
  for (let i = 0; i < viewA.length; i++) {
    difference |= (viewA[i] ?? 0) ^ (viewB[i] ?? 0);
  }
  return difference === 0;
}
