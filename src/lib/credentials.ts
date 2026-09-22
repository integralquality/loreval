/**
 * Multi-provider API key store.
 *
 * Keys live in localStorage and are sent straight to the provider through our
 * proxy — never persisted server-side. One credential per provider, so a user
 * can hold an Anthropic key and an OpenAI key at once and evaluate both.
 *
 * Supersedes the single-config `loreval_guest_config` store; anything found
 * under the old key is migrated on first read.
 */
import {
  PROVIDERS,
  getProvider,
  isProviderId,
  modelKey,
  qualify,
  type ProviderId,
  type QualifiedModel,
} from './providers';

const STORAGE_KEY = 'loreval_credentials';
const LEGACY_KEY = 'loreval_guest_config';

export interface Credential {
  provider: ProviderId;
  key: string;
  /** Only meaningful for providers with an editable base URL. */
  baseUrl: string;
  /** Extra model ids the user added by hand, beyond the curated catalog. */
  customModels: string[];
}

export type CredentialStore = Partial<Record<ProviderId, Credential>>;

interface LegacyConfig {
  provider?: string;
  key?: string;
  model?: string;
  baseUrl?: string;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Fired whenever the stored keys change, so open pickers can refresh. */
export const CREDENTIALS_CHANGED_EVENT = 'loreval:credentials-changed';

function writeStore(store: CredentialStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode, blocked) — keys simply don't persist.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CREDENTIALS_CHANGED_EVENT));
  }
}

function sanitize(raw: unknown): CredentialStore {
  if (!raw || typeof raw !== 'object') return {};
  const store: CredentialStore = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isProviderId(id) || !value || typeof value !== 'object') continue;
    const entry = value as Partial<Credential>;
    if (typeof entry.key !== 'string' || !entry.key) continue;
    store[id] = {
      provider: id,
      key: entry.key,
      baseUrl: typeof entry.baseUrl === 'string' ? entry.baseUrl : '',
      customModels: Array.isArray(entry.customModels)
        ? entry.customModels.filter((m): m is string => typeof m === 'string' && m.length > 0)
        : [],
    };
  }
  return store;
}

/** Convert a pre-multi-key config into a store entry. Exported for testing. */
export function migrateLegacy(raw: string | null): CredentialStore {
  if (!raw) return {};
  let parsed: LegacyConfig;
  try {
    parsed = JSON.parse(raw) as LegacyConfig;
  } catch {
    return {};
  }
  const providerId = parsed.provider && isProviderId(parsed.provider) ? parsed.provider : 'anthropic';
  if (!parsed.key) return {};

  const provider = getProvider(providerId);
  const catalogued = provider?.models.some(m => m.id === parsed.model) ?? false;

  return {
    [providerId]: {
      provider: providerId,
      key: parsed.key,
      baseUrl: parsed.baseUrl ?? '',
      // The old store kept a single free-text model — preserve it if it isn't
      // already in the catalog, so the user's chosen model survives the upgrade.
      customModels: parsed.model && !catalogued ? [parsed.model] : [],
    },
  };
}

export function getCredentials(): CredentialStore {
  const raw = readRaw(STORAGE_KEY);
  if (raw) {
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  const migrated = migrateLegacy(readRaw(LEGACY_KEY));
  if (Object.keys(migrated).length > 0) {
    writeStore(migrated);
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Best effort — a surviving legacy entry is ignored once the new key exists.
    }
  }
  return migrated;
}

export function getCredential(providerId: string): Credential | null {
  if (!isProviderId(providerId)) return null;
  return getCredentials()[providerId] ?? null;
}

export function saveCredential(
  providerId: ProviderId,
  input: { key: string; baseUrl?: string; customModels?: string[] },
): void {
  const store = getCredentials();
  const existing = store[providerId];
  store[providerId] = {
    provider: providerId,
    key: input.key.trim(),
    baseUrl: (input.baseUrl ?? existing?.baseUrl ?? '').trim(),
    customModels: input.customModels ?? existing?.customModels ?? [],
  };
  writeStore(store);
}

export function removeCredential(providerId: ProviderId): void {
  const store = getCredentials();
  delete store[providerId];
  writeStore(store);
}

export function addCustomModel(providerId: ProviderId, modelId: string): void {
  const trimmed = modelId.trim();
  if (!trimmed) return;
  const store = getCredentials();
  const existing = store[providerId];
  if (!existing) return;
  if (existing.customModels.includes(trimmed)) return;
  existing.customModels = [...existing.customModels, trimmed];
  writeStore(store);
}

export function removeCustomModel(providerId: ProviderId, modelId: string): void {
  const store = getCredentials();
  const existing = store[providerId];
  if (!existing) return;
  existing.customModels = existing.customModels.filter(m => m !== modelId);
  writeStore(store);
}

export function hasAnyCredential(): boolean {
  return Object.keys(getCredentials()).length > 0;
}

export function configuredProviderIds(): ProviderId[] {
  const store = getCredentials();
  return PROVIDERS.filter(p => store[p.id]).map(p => p.id);
}

/**
 * Every model the user can actually run right now: catalog entries plus their
 * own additions, for providers that have a key.
 */
export function availableModels(): QualifiedModel[] {
  const store = getCredentials();
  const out: QualifiedModel[] = [];

  for (const provider of PROVIDERS) {
    const cred = store[provider.id];
    if (!cred) continue;
    for (const model of provider.models) {
      out.push(qualify(provider, model));
    }
    for (const id of cred.customModels) {
      if (provider.models.some(m => m.id === id)) continue;
      out.push(qualify(provider, { id, label: id, note: 'Custom' }));
    }
  }
  return out;
}

/** Resolve a `provider:model` selection key into request parameters. */
export interface ResolvedModel {
  providerId: ProviderId;
  modelId: string;
  label: string;
  key: string;
  baseUrl: string;
}

export function resolveModelSelection(selection: string): ResolvedModel | null {
  const model = availableModels().find(m => modelKey(m.providerId, m.id) === selection);
  if (!model) return null;
  const cred = getCredentials()[model.providerId];
  if (!cred) return null;
  const provider = getProvider(model.providerId)!;
  return {
    providerId: model.providerId,
    modelId: model.id,
    label: model.label,
    key: cred.key,
    baseUrl: cred.baseUrl || provider.baseUrl,
  };
}

/** The model used when the caller doesn't pick one (first available). */
export function defaultModelSelection(): string | null {
  const [first] = availableModels();
  return first ? modelKey(first.providerId, first.id) : null;
}
