const STORAGE_KEY = 'loreval_guest_config';

export interface GuestConfig {
  provider: string;   // 'anthropic' | 'openai' | 'groq' | 'custom'
  key: string;
  model: string;
  baseUrl: string;    // empty for Anthropic, required for OpenAI-compatible
}

export const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: '',
    defaultModel: 'claude-sonnet-4-6',
    keyHint: 'sk-ant-...',
    modelSuggestions: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    keyHint: 'sk-...',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyHint: 'gsk_...',
    modelSuggestions: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    id: 'custom',
    label: 'Custom / Local',
    baseUrl: '',
    defaultModel: '',
    keyHint: 'your-api-key',
    modelSuggestions: [],
  },
] as const;

export function getGuestConfig(): GuestConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestConfig) : null;
  } catch {
    return null;
  }
}

export function setGuestConfig(config: GuestConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearGuestConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasGuestKey(): boolean {
  return !!getGuestConfig()?.key;
}

// used by ai-solver / ai-generator to attach config to requests
export function getGuestKey(): string | null {
  return getGuestConfig()?.key ?? null;
}
