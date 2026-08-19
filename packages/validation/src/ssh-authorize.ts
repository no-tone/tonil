import { z } from "zod";

/**
 * An OpenSSH SHA256 key fingerprint, as `ssh-keygen -lf` prints it.
 *
 * Constrained rather than accepting any string because it is the sole input
 * to a lookup that decides access: base64 of a SHA-256 digest is exactly 43
 * unpadded characters, so anything else is malformed by construction and
 * should be rejected before it reaches the allowlist.
 */
export const sshFingerprintSchema = z
  .string()
  .regex(
    /^SHA256:[A-Za-z0-9+/]{43}$/,
    "expected an OpenSSH SHA256 fingerprint, e.g. SHA256:<43 base64 chars>",
  );

export const sshAuthorizeBodySchema = z.object({
  fingerprint: sshFingerprintSchema,
});

export type SshAuthorizeBody = z.infer<typeof sshAuthorizeBodySchema>;
