/**
 * Catalog of LLM providers and the models LOREVAL can evaluate.
 *
 * `models` is a curated starting list, not a closed set — every provider
 * accepts a user-supplied model id too (see `customModels` in credentials.ts),
 * which keeps the app useful as providers ship new models.
 */

export type ProviderId = 'anthropic' | 'openai' | 'google' | 'groq' | 'openrouter' | 'custom';

/** Wire protocol used to talk to a provider. */
export type ProviderKind = 'anthropic' | 'openai-compatible';

export interface ModelDef {
  id: string;
  label: string;
  note?: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** Default API base. Empty for Anthropic — it uses its own native endpoint. */
  baseUrl: string;
  /** Whether the user may override baseUrl (true for self-hosted / gateways). */
  editableBaseUrl: boolean;
  keyHint: string;
  /** Where to get a key, shown as a link in the key modal. */
  keysUrl?: string;
  models: ModelDef[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: '',
    editableBaseUrl: false,
    keyHint: 'sk-ant-...',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5', note: 'Most capable' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Balanced' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'Fast and cheap' },
      { id: 'claude-fable-5-1', label: 'Fable 5.1', note: 'Frontier, premium pricing' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    editableBaseUrl: false,
    keyHint: 'sk-...',
    keysUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', note: 'Fast and cheap' },
      { id: 'o3-mini', label: 'o3-mini', note: 'Reasoning' },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    editableBaseUrl: false,
    keyHint: 'AIza...',
    keysUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', note: 'Fast' },
      { id: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    editableBaseUrl: false,
    keyHint: 'gsk_...',
    keysUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', note: 'Fast' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    editableBaseUrl: false,
    keyHint: 'sk-or-...',
    keysUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'anthropic/claude-opus-5', label: 'Opus 5 (via OR)' },
      { id: 'openai/gpt-4o', label: 'GPT-4o (via OR)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (via OR)' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom / Local',
    kind: 'openai-compatible',
    baseUrl: '',
    editableBaseUrl: true,
    keyHint: 'your-api-key',
    models: [],
  },
];

export const PROVIDER_IDS: ProviderId[] = PROVIDERS.map(p => p.id);

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id);
}

/** Provider lookup that always returns something — falls back to Anthropic. */
export function getProviderOrDefault(id: string | undefined): ProviderDef {
  return getProvider(id ?? '') ?? PROVIDERS[0];
}

export function isProviderId(id: string): id is ProviderId {
  return PROVIDERS.some(p => p.id === id);
}

/** A model paired with the provider that serves it. */
export interface QualifiedModel extends ModelDef {
  providerId: ProviderId;
  providerLabel: string;
}

export function qualify(provider: ProviderDef, model: ModelDef): QualifiedModel {
  return { ...model, providerId: provider.id, providerLabel: provider.label };
}

/** Stable key for a provider+model pair, used as a selection id in the UI. */
export function modelKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

export function parseModelKey(key: string): { providerId: string; modelId: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0 || idx === key.length - 1) return null;
  return { providerId: key.slice(0, idx), modelId: key.slice(idx + 1) };
}
