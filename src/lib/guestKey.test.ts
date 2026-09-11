import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROVIDERS,
  clearGuestConfig,
  getGuestConfig,
  getGuestKey,
  hasGuestKey,
  setGuestConfig,
  type GuestConfig,
} from './guestKey';
import { installFailingLocalStorage, installLocalStorageStub } from '../test/local-storage';

const KEY = 'loreval_guest_config';

const CONFIG: GuestConfig = {
  provider: 'anthropic',
  key: 'test-key',
  model: 'test-model',
  baseUrl: '',
};

let store: Record<string, string>;

beforeEach(() => {
  store = installLocalStorageStub();
});

describe('getGuestConfig', () => {
  it('returns null when nothing is stored', () => {
    expect(getGuestConfig()).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    store[KEY] = '{oops';
    expect(getGuestConfig()).toBeNull();
  });

  it('returns null when storage is unavailable', () => {
    installFailingLocalStorage();
    expect(getGuestConfig()).toBeNull();
  });
});

describe('setGuestConfig', () => {
  it('round-trips a config through storage', () => {
    setGuestConfig(CONFIG);
    expect(getGuestConfig()).toEqual(CONFIG);
  });

  it('stores it under the expected key as JSON', () => {
    setGuestConfig(CONFIG);
    expect(JSON.parse(store[KEY])).toEqual(CONFIG);
  });

  it('replaces an existing config', () => {
    setGuestConfig(CONFIG);
    setGuestConfig({ ...CONFIG, provider: 'groq', key: 'other-key' });
    expect(getGuestConfig()).toMatchObject({ provider: 'groq', key: 'other-key' });
  });
});

describe('clearGuestConfig', () => {
  it('removes a stored config', () => {
    setGuestConfig(CONFIG);
    clearGuestConfig();
    expect(getGuestConfig()).toBeNull();
    expect(hasGuestKey()).toBe(false);
  });

  it('is a no-op when nothing is stored', () => {
    expect(() => clearGuestConfig()).not.toThrow();
  });
});

describe('key accessors', () => {
  it('reports no key before a config is saved', () => {
    expect(hasGuestKey()).toBe(false);
    expect(getGuestKey()).toBeNull();
  });

  it('reads the key out of a saved config', () => {
    setGuestConfig(CONFIG);
    expect(hasGuestKey()).toBe(true);
    expect(getGuestKey()).toBe('test-key');
  });

  it('treats an empty key as no key', () => {
    setGuestConfig({ ...CONFIG, key: '' });
    expect(hasGuestKey()).toBe(false);
    expect(getGuestKey()).toBe('');
  });
});

describe('PROVIDERS', () => {
  it('has unique ids', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every provider a label and a key hint', () => {
    for (const provider of PROVIDERS) {
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.keyHint.length).toBeGreaterThan(0);
    }
  });

  it('lists each default model among that provider’s suggestions', () => {
    for (const provider of PROVIDERS) {
      if (!provider.defaultModel) continue;
      expect(provider.modelSuggestions as readonly string[]).toContain(provider.defaultModel);
    }
  });

  it('gives OpenAI-compatible providers an absolute base URL', () => {
    for (const provider of PROVIDERS) {
      if (!provider.baseUrl) continue;
      expect(provider.baseUrl).toMatch(/^https:\/\//);
    }
  });

  it('leaves the Anthropic base URL empty so the native API is used', () => {
    const anthropic = PROVIDERS.find(p => p.id === 'anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic!.baseUrl).toBe('');
  });
});
