/**
 * Talks to apps/api's Better Auth instance (a different origin — see
 * packages/auth's TRUSTED_ORIGINS/crossSubDomainCookies for how the session
 * cookie is shared across *.no-tone.com). Kept separate from login.astro's
 * DOM wiring so the request/response handling is unit-testable.
 */

const AUTH_ORIGIN = "https://api.no-tone.com";

interface SignInResult {
  ok: boolean;
  message?: string;
}

interface BetterAuthErrorBody {
  message?: string;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInResult> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, message: "Couldn't reach the auth server." };
  }
  if (res.ok) return { ok: true };
  const body = (await res
    .json()
    .catch(() => null)) as BetterAuthErrorBody | null;
  return { ok: false, message: body?.message || "Wrong email or password." };
}

export async function signOut(): Promise<void> {
  await fetch(`${AUTH_ORIGIN}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}
