const STORAGE_KEY = 'loreval_guest_api_key';

export function getGuestKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setGuestKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearGuestKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasGuestKey(): boolean {
  return !!getGuestKey();
}
