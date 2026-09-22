import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCustomModel,
  availableModels,
  configuredProviderIds,
  defaultModelSelection,
  getCredential,
  getCredentials,
  hasAnyCredential,
  migrateLegacy,
  removeCredential,
  removeCustomModel,
  resolveModelSelection,
  saveCredential,
} from './credentials';
import { PROVIDERS, getProvider, modelKey } from './providers';
import { installFailingLocalStorage, installLocalStorageStub } from '../test/local-storage';

const STORAGE_KEY = 'loreval_credentials';
const LEGACY_KEY = 'loreval_guest_config';

let store: Record<string, string>;

beforeEach(() => {
  store = installLocalStorageStub();
});

describe('saving and reading keys', () => {
  it('starts empty', () => {
    expect(getCredentials()).toEqual({});
    expect(hasAnyCredential()).toBe(false);
    expect(defaultModelSelection()).toBeNull();
  });

  it('round-trips a credential', () => {
    saveCredential('anthropic', { key: 'sk-ant-test' });
    expect(getCredential('anthropic')).toMatchObject({
      provider: 'anthropic',
      key: 'sk-ant-test',
      customModels: [],
    });
    expect(hasAnyCredential()).toBe(true);
  });

  it('holds several providers at once', () => {
    saveCredential('anthropic', { key: 'sk-ant-test' });
    saveCredential('openai', { key: 'sk-openai-test' });
    expect(configuredProviderIds()).toEqual(['anthropic', 'openai']);
  });

  it('trims whitespace off the key', () => {
    saveCredential('groq', { key: '  gsk_padded  ' });
    expect(getCredential('groq')!.key).toBe('gsk_padded');
  });

  it('updates a key without dropping custom models', () => {
    saveCredential('openai', { key: 'first' });
    addCustomModel('openai', 'gpt-5-preview');
    saveCredential('openai', { key: 'second' });
    expect(getCredential('openai')).toMatchObject({
      key: 'second',
      customModels: ['gpt-5-preview'],
    });
  });

  it('removes a credential', () => {
    saveCredential('anthropic', { key: 'sk-ant-test' });
    removeCredential('anthropic');
    expect(getCredential('anthropic')).toBeNull();
    expect(hasAnyCredential()).toBe(false);
  });

  it('ignores an unknown provider id', () => {
    expect(getCredential('not-a-provider')).toBeNull();
  });

  it('drops malformed entries instead of throwing', () => {
    store[STORAGE_KEY] = JSON.stringify({
      anthropic: { key: 'good' },
      bogus: { key: 'x' },
      openai: { key: 42 },
    });
    expect(Object.keys(getCredentials())).toEqual(['anthropic']);
  });

  it('survives unusable storage', () => {
    installFailingLocalStorage();
    expect(getCredentials()).toEqual({});
    expect(() => saveCredential('anthropic', { key: 'k' })).not.toThrow();
  });

  it('returns nothing when the stored value is not JSON', () => {
    store[STORAGE_KEY] = 'nonsense';
    expect(getCredentials()).toEqual({});
  });
});

describe('custom models', () => {
  beforeEach(() => saveCredential('openai', { key: 'sk-test' }));

  it('adds and removes a model id', () => {
    addCustomModel('openai', 'o4-mini');
    expect(getCredential('openai')!.customModels).toEqual(['o4-mini']);
    removeCustomModel('openai', 'o4-mini');
    expect(getCredential('openai')!.customModels).toEqual([]);
  });

  it('ignores duplicates and blanks', () => {
    addCustomModel('openai', 'o4-mini');
    addCustomModel('openai', 'o4-mini');
    addCustomModel('openai', '   ');
    expect(getCredential('openai')!.customModels).toEqual(['o4-mini']);
  });

  it('does nothing for a provider with no key', () => {
    addCustomModel('groq', 'llama-x');
    expect(getCredential('groq')).toBeNull();
  });
});

describe('migration from the single-key store', () => {
  it('moves a legacy config into the new store on first read', () => {
    store[LEGACY_KEY] = JSON.stringify({
      provider: 'anthropic',
      key: 'sk-ant-old',
      model: 'claude-opus-5',
      baseUrl: '',
    });
    const creds = getCredentials();
    expect(creds.anthropic).toMatchObject({ key: 'sk-ant-old' });
    // Migrated forward and the legacy entry cleaned up.
    expect(store[STORAGE_KEY]).toBeDefined();
    expect(store[LEGACY_KEY]).toBeUndefined();
  });

  it('keeps a legacy model id that is not in the catalog', () => {
    const migrated = migrateLegacy(
      JSON.stringify({ provider: 'openai', key: 'sk-old', model: 'gpt-4-turbo-preview' }),
    );
    expect(migrated.openai!.customModels).toEqual(['gpt-4-turbo-preview']);
  });

  it('does not duplicate a model already in the catalog', () => {
    const catalogued = getProvider('anthropic')!.models[0].id;
    const migrated = migrateLegacy(
      JSON.stringify({ provider: 'anthropic', key: 'sk-old', model: catalogued }),
    );
    expect(migrated.anthropic!.customModels).toEqual([]);
  });

  it('assumes Anthropic when the legacy provider is unknown', () => {
    const migrated = migrateLegacy(JSON.stringify({ provider: 'mystery', key: 'sk-old' }));
    expect(Object.keys(migrated)).toEqual(['anthropic']);
  });

  it('ignores a legacy config with no key, and junk', () => {
    expect(migrateLegacy(JSON.stringify({ provider: 'anthropic' }))).toEqual({});
    expect(migrateLegacy('not json')).toEqual({});
    expect(migrateLegacy(null)).toEqual({});
  });
});

describe('availableModels', () => {
  it('is empty without keys', () => {
    expect(availableModels()).toEqual([]);
  });

  it('lists only models from providers that have a key', () => {
    saveCredential('anthropic', { key: 'sk-ant' });
    const ids = availableModels().map(m => m.providerId);
    expect(new Set(ids)).toEqual(new Set(['anthropic']));
    expect(availableModels().length).toBe(getProvider('anthropic')!.models.length);
  });

  it('includes custom models alongside the catalog', () => {
    saveCredential('anthropic', { key: 'sk-ant' });
    addCustomModel('anthropic', 'claude-experimental');
    const custom = availableModels().find(m => m.id === 'claude-experimental');
    expect(custom).toMatchObject({ providerId: 'anthropic', note: 'Custom' });
  });

  it('does not duplicate a custom model that is already catalogued', () => {
    saveCredential('anthropic', { key: 'sk-ant' });
    const catalogued = getProvider('anthropic')!.models[0].id;
    addCustomModel('anthropic', catalogued);
    expect(availableModels().filter(m => m.id === catalogued)).toHaveLength(1);
  });

  it('spans providers', () => {
    saveCredential('anthropic', { key: 'a' });
    saveCredential('groq', { key: 'g' });
    const providers = new Set(availableModels().map(m => m.providerId));
    expect(providers).toEqual(new Set(['anthropic', 'groq']));
  });
});

describe('resolveModelSelection', () => {
  beforeEach(() => saveCredential('anthropic', { key: 'sk-ant-test' }));

  it('resolves a selection into request parameters', () => {
    const first = getProvider('anthropic')!.models[0];
    const resolved = resolveModelSelection(modelKey('anthropic', first.id));
    expect(resolved).toMatchObject({
      providerId: 'anthropic',
      modelId: first.id,
      key: 'sk-ant-test',
      baseUrl: '',
    });
  });

  it('returns null for a model with no key behind it', () => {
    expect(resolveModelSelection(modelKey('openai', 'gpt-4o'))).toBeNull();
  });

  it('returns null for a malformed selection', () => {
    expect(resolveModelSelection('garbage')).toBeNull();
  });

  it('falls back to the provider base URL when none is stored', () => {
    saveCredential('groq', { key: 'g' });
    const model = getProvider('groq')!.models[0];
    expect(resolveModelSelection(modelKey('groq', model.id))!.baseUrl).toBe(
      getProvider('groq')!.baseUrl,
    );
  });

  it('prefers a stored base URL for custom providers', () => {
    saveCredential('custom', { key: 'k', baseUrl: 'http://localhost:11434/v1' });
    addCustomModel('custom', 'llama-local');
    expect(resolveModelSelection(modelKey('custom', 'llama-local'))!.baseUrl).toBe(
      'http://localhost:11434/v1',
    );
  });

  it('defaults to the first available model', () => {
    const selection = defaultModelSelection();
    expect(selection).toBe(modelKey('anthropic', getProvider('anthropic')!.models[0].id));
    expect(resolveModelSelection(selection!)).not.toBeNull();
  });
});

describe('provider catalog invariants', () => {
  it('has unique provider ids', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every provider a label and key hint', () => {
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.keyHint.length).toBeGreaterThan(0);
    }
  });

  it('has unique model ids within each provider', () => {
    for (const p of PROVIDERS) {
      const ids = p.models.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gives OpenAI-compatible providers an https base URL unless user-supplied', () => {
    for (const p of PROVIDERS) {
      if (p.kind !== 'openai-compatible' || p.editableBaseUrl) continue;
      expect(p.baseUrl).toMatch(/^https:\/\//);
    }
  });

  it('leaves the Anthropic base URL empty so the native API is used', () => {
    expect(getProvider('anthropic')!.baseUrl).toBe('');
    expect(getProvider('anthropic')!.kind).toBe('anthropic');
  });

  it('uses current, unsuffixed Anthropic model ids', () => {
    for (const model of getProvider('anthropic')!.models) {
      expect(model.id).toMatch(/^claude-/);
      expect(model.id).not.toMatch(/-\d{8}$/);
    }
  });
});
