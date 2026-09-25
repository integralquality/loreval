import { useState } from 'react';
import { X, Eye, EyeOff, Key, Check, Plus, Trash2, ExternalLink } from 'lucide-react';
import {
  addCustomModel,
  getCredentials,
  removeCredential,
  removeCustomModel,
  saveCredential,
  type CredentialStore,
} from '../../lib/credentials';
import { PROVIDERS, getProviderOrDefault, type ProviderId } from '../../lib/providers';

interface Props {
  onClose: () => void;
  onSave: () => void;
}

const inputCls =
  'w-full bg-surface border border-white/15 rounded px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-400 transition-colors';

export function ApiKeysModal({ onClose, onSave }: Props) {
  const [store, setStore] = useState<CredentialStore>(() => getCredentials());
  const [providerId, setProviderId] = useState<ProviderId>(() => {
    const configured = PROVIDERS.find(p => getCredentials()[p.id]);
    return configured?.id ?? 'anthropic';
  });

  const provider = getProviderOrDefault(providerId);
  const saved = store[providerId];

  const [keyDraft, setKeyDraft] = useState(saved?.key ?? '');
  const [urlDraft, setUrlDraft] = useState(saved?.baseUrl ?? '');
  const [modelDraft, setModelDraft] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    setStore(getCredentials());
    onSave();
  };

  const selectProvider = (id: ProviderId) => {
    const current = getCredentials()[id];
    setProviderId(id);
    setKeyDraft(current?.key ?? '');
    setUrlDraft(current?.baseUrl ?? '');
    setModelDraft('');
    setError('');
  };

  const handleSave = () => {
    const key = keyDraft.trim();
    if (!key) {
      setError('API key is required.');
      return;
    }
    const baseUrl = provider.editableBaseUrl ? urlDraft.trim() : provider.baseUrl;
    if (provider.editableBaseUrl && !baseUrl) {
      setError('Base URL is required for a custom provider.');
      return;
    }
    saveCredential(providerId, { key, baseUrl });
    setError('');
    refresh();
  };

  const handleRemove = () => {
    removeCredential(providerId);
    setKeyDraft('');
    setUrlDraft('');
    refresh();
  };

  const handleAddModel = () => {
    const id = modelDraft.trim();
    if (!id) return;
    if (!store[providerId]) {
      setError('Save an API key for this provider first.');
      return;
    }
    addCustomModel(providerId, id);
    setModelDraft('');
    refresh();
  };

  const customModels = store[providerId]?.customModels ?? [];
  const configuredCount = Object.keys(store).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-paper ring-1 ring-zinc-700 rounded-lg w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-orange-500/15 border border-orange-500/30 rounded flex items-center justify-center">
            <Key size={15} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">API keys</h2>
            <p className="text-xs text-zinc-500">
              {configuredCount === 0
                ? 'Stored locally in your browser only'
                : `${configuredCount} provider${configuredCount === 1 ? '' : 's'} configured`}
            </p>
          </div>
        </div>

        {/* Provider tabs — a check marks the ones holding a key */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {PROVIDERS.map(p => {
            const hasKey = Boolean(store[p.id]);
            const active = providerId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => selectProvider(p.id)}
                className={`py-2 px-2 rounded text-xs font-medium transition-all border flex items-center justify-center gap-1 ${
                  active
                    ? 'bg-zinc-100 border-zinc-100 text-paper'
                    : 'bg-surface/60 border-white/15 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100'
                }`}
              >
                {hasKey && <Check size={11} className={active ? 'text-green-400' : 'text-green-400'} />}
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-400">API key</label>
              {provider.keysUrl && (
                <a
                  href={provider.keysUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-zinc-500 hover:text-zinc-100 flex items-center gap-1 transition-colors"
                >
                  Get a key <ExternalLink size={10} />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={visible ? 'text' : 'password'}
                value={keyDraft}
                onChange={e => {
                  setKeyDraft(e.target.value);
                  setError('');
                }}
                placeholder={provider.keyHint}
                className={`${inputCls} pr-10`}
                autoFocus
              />
              <button
                onClick={() => setVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {provider.editableBaseUrl && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Base URL</label>
              <input
                type="text"
                value={urlDraft}
                onChange={e => {
                  setUrlDraft(e.target.value);
                  setError('');
                }}
                placeholder="http://localhost:11434/v1"
                className={inputCls}
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Any OpenAI-compatible endpoint (Ollama, vLLM, a gateway).
              </p>
            </div>
          )}

          {/* Models this provider contributes to the picker */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Models</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {provider.models.map(m => (
                <span
                  key={m.id}
                  title={m.id}
                  className="px-2 py-1 rounded bg-surface/60 border border-white/15 text-[11px] text-zinc-400"
                >
                  {m.label}
                </span>
              ))}
              {customModels.map(id => (
                <span
                  key={id}
                  className="px-2 py-1 rounded bg-orange-500/10 border border-orange-500/30 text-[11px] text-zinc-300 font-mono flex items-center gap-1"
                >
                  {id}
                  <button
                    onClick={() => {
                      removeCustomModel(providerId, id);
                      refresh();
                    }}
                    className="text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
              {provider.models.length === 0 && customModels.length === 0 && (
                <span className="text-[11px] text-zinc-500">
                  No preset models — add a model id below.
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={modelDraft}
                onChange={e => setModelDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddModel();
                }}
                placeholder="add another model id"
                className={`${inputCls} text-xs py-2`}
              />
              <button
                onClick={handleAddModel}
                className="px-3 border border-white/15 rounded text-zinc-400 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                title="Add model"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <p className="text-xs text-zinc-500 leading-relaxed">
            Keys are saved in <code className="font-mono">localStorage</code> on this device and
            sent from your browser straight to the provider. They never reach a server of ours.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-zinc-100 hover:bg-zinc-300 text-paper text-sm font-medium rounded transition-colors"
            >
              {saved ? 'Update key' : 'Save key'}
            </button>
            {saved && (
              <button
                onClick={handleRemove}
                className="px-4 py-2 border border-white/15 text-zinc-500 hover:border-red-500/50 hover:text-red-400 text-sm rounded transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
