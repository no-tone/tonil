export function generateNonce(): string {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
  } catch {
    return (
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    );
  }
}
