// GDPR consent management.
// Stored in localStorage for immediate UI gating.

const CONSENT_KEY = 'gdpr-consent';

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  decided: boolean; // true once the user has made a choice (accept or reject)
}

const DEFAULT_STATE: ConsentState = {
  analytics: false,
  marketing: false,
  decided: false,
};

export function getConsent(): ConsentState {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return DEFAULT_STATE;
    return JSON.parse(stored) as ConsentState;
  } catch {
    return DEFAULT_STATE;
  }
}

export function setConsent(consent: Omit<ConsentState, 'decided'>): ConsentState {
  const state: ConsentState = { ...consent, decided: true };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  return state;
}

export function hasDecided(): boolean {
  return getConsent().decided;
}

export function isAnalyticsAllowed(): boolean {
  return getConsent().analytics;
}
