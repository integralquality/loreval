import { describe, expect, it } from 'vitest';
import {
  PROVIDERS,
  getProvider,
  getProviderOrDefault,
  isProviderId,
  modelKey,
  parseModelKey,
  qualify,
} from './providers';

describe('lookup', () => {
  it('finds every provider by id', () => {
    for (const p of PROVIDERS) {
      expect(getProvider(p.id)).toBe(p);
      expect(isProviderId(p.id)).toBe(true);
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getProvider('nope')).toBeUndefined();
    expect(isProviderId('nope')).toBe(false);
  });

  it('falls back to the first provider', () => {
    expect(getProviderOrDefault('nope')).toBe(PROVIDERS[0]);
    expect(getProviderOrDefault(undefined)).toBe(PROVIDERS[0]);
  });
});

describe('modelKey', () => {
  it('round-trips a provider and model id', () => {
    const key = modelKey('anthropic', 'claude-opus-5');
    expect(key).toBe('anthropic:claude-opus-5');
    expect(parseModelKey(key)).toEqual({ providerId: 'anthropic', modelId: 'claude-opus-5' });
  });

  it('keeps model ids that contain a slash or colon intact', () => {
    const key = modelKey('openrouter', 'anthropic/claude-opus-5');
    expect(parseModelKey(key)).toEqual({
      providerId: 'openrouter',
      modelId: 'anthropic/claude-opus-5',
    });
  });

  it('splits on the first colon only', () => {
    expect(parseModelKey('custom:host:8080/model')).toEqual({
      providerId: 'custom',
      modelId: 'host:8080/model',
    });
  });

  it('rejects malformed keys', () => {
    expect(parseModelKey('no-colon')).toBeNull();
    expect(parseModelKey(':leading')).toBeNull();
    expect(parseModelKey('trailing:')).toBeNull();
    expect(parseModelKey('')).toBeNull();
  });
});

describe('qualify', () => {
  it('tags a model with its provider', () => {
    const provider = getProvider('anthropic')!;
    const qualified = qualify(provider, provider.models[0]);
    expect(qualified).toMatchObject({
      providerId: 'anthropic',
      providerLabel: provider.label,
      id: provider.models[0].id,
    });
  });
});
