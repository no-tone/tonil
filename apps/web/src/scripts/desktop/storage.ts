/* Tiny localStorage wrapper — every read/write is guarded so a disabled or
   full storage (Safari private mode, quota errors, …) never throws and
   breaks the app; callers just get a null read / silently-dropped write. */

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* no-op */
  }
}
