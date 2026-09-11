/**
 * Test helper: the unit suite runs in the `node` environment, which has no
 * localStorage. This installs a minimal in-memory stand-in and hands back the
 * backing object so a test can seed or inspect raw values.
 */
export function installLocalStorageStub(): Record<string, string> {
  const store: Record<string, string> = {};

  const stub: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  });

  return store;
}

/** Replace localStorage with one that throws on every access. */
export function installFailingLocalStorage(): void {
  const fail = () => {
    throw new Error('localStorage unavailable');
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: fail, setItem: fail, removeItem: fail, clear: fail },
    configurable: true,
    writable: true,
  });
}
