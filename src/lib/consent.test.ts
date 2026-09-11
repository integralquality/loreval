import { beforeEach, describe, expect, it } from 'vitest';
import { getConsent, hasDecided, isAnalyticsAllowed, setConsent } from './consent';
import { installFailingLocalStorage, installLocalStorageStub } from '../test/local-storage';

const KEY = 'gdpr-consent';
let store: Record<string, string>;

beforeEach(() => {
  store = installLocalStorageStub();
});

describe('getConsent', () => {
  it('defaults to undecided with everything off', () => {
    expect(getConsent()).toEqual({ analytics: false, marketing: false, decided: false });
  });

  it('reads back a stored decision', () => {
    store[KEY] = JSON.stringify({ analytics: true, marketing: false, decided: true });
    expect(getConsent()).toEqual({ analytics: true, marketing: false, decided: true });
  });

  it('falls back to the default when the stored value is not valid JSON', () => {
    store[KEY] = 'not json';
    expect(getConsent()).toEqual({ analytics: false, marketing: false, decided: false });
  });

  it('falls back to the default when storage is unavailable', () => {
    installFailingLocalStorage();
    expect(getConsent()).toEqual({ analytics: false, marketing: false, decided: false });
  });
});

describe('setConsent', () => {
  it('marks the choice as decided and persists it', () => {
    const state = setConsent({ analytics: true, marketing: true });
    expect(state).toEqual({ analytics: true, marketing: true, decided: true });
    expect(JSON.parse(store[KEY])).toEqual(state);
  });

  it('marks a rejection as decided too', () => {
    setConsent({ analytics: false, marketing: false });
    expect(hasDecided()).toBe(true);
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('overwrites a previous decision', () => {
    setConsent({ analytics: true, marketing: true });
    setConsent({ analytics: false, marketing: false });
    expect(getConsent()).toEqual({ analytics: false, marketing: false, decided: true });
  });
});

describe('derived helpers', () => {
  it('reports no decision before a choice is made', () => {
    expect(hasDecided()).toBe(false);
    expect(isAnalyticsAllowed()).toBe(false);
  });

  it('reports analytics as allowed only when opted in', () => {
    setConsent({ analytics: true, marketing: false });
    expect(isAnalyticsAllowed()).toBe(true);
  });
});
