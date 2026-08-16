/**
 * A single AbortController+setTimeout wrapper around `fetch`, shared by every
 * "is this endpoint reachable" check in the monorepo (apps/api's server-side
 * app-health probe, apps/dashboard's client-side ping and status fetch) —
 * previously three near-identical copies of this exact pattern.
 *
 * Callers keep their own try/catch and response-interpretation logic; this
 * only owns the timeout plumbing.
 */
export async function fetchWithTimeout(
  input: string | URL,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
