/**
 * DOM wiring for login.astro's form — thin glue, same pattern as
 * dashboard.ts. The actual request logic (worth testing on its own) lives in
 * auth-client.ts.
 */
import { signInWithEmail } from "./auth-client";

interface LoginFormElements {
  form: HTMLFormElement;
  submitButton: HTMLButtonElement;
  errorEl: HTMLElement;
}

export function wireLoginForm({
  form,
  submitButton,
  errorEl,
}: LoginFormElements): void {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    errorEl.hidden = true;
    submitButton.disabled = true;

    const result = await signInWithEmail(email, password);
    if (result.ok) {
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("redirect") || "/";
      return;
    }

    errorEl.textContent = result.message ?? "Wrong email or password.";
    errorEl.hidden = false;
    submitButton.disabled = false;
  });
}
