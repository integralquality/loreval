import { useState } from 'react';
import { X, Eye, EyeOff, Key } from 'lucide-react';
import { getGuestConfig, setGuestConfig, clearGuestConfig, PROVIDERS } from '../../lib/guestKey';

interface Props {
  onClose: () => void;
  onSave: () => void;
}

const inputCls = 'w-full bg-white border border-zinc-900/20 rounded px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 font-mono focus:outline-none focus:border-zinc-900 transition-colors';

export function GuestKeyModal({ onClose, onSave }: Props) {
  const existing = getGuestConfig();

  const [providerId, setProviderId] = useState(existing?.provider ?? 'anthropic');
  const [key, setKey]               = useState(existing?.key ?? '');
  const [model, setModel]           = useState(existing?.model ?? '');
  const [baseUrl, setBaseUrl]       = useState(existing?.baseUrl ?? '');
  const [visible, setVisible]       = useState(false);
  const [error, setError]           = useState('');

  const provider = PROVIDERS.find(p => p.id === providerId) ?? PROVIDERS[0];

  const handleProviderChange = (id: string) => {
    const p = PROVIDERS.find(pr => pr.id === id) ?? PROVIDERS[0];
    setProviderId(id);
    setModel(p.defaultModel);
    setBaseUrl(p.baseUrl);
    setError('');
  };

  const handleSave = () => {
    const trimmedKey = key.trim();
    const trimmedModel = model.trim() || provider.defaultModel;
    const trimmedUrl = providerId === 'anthropic' ? '' : (baseUrl.trim() || provider.baseUrl);

    if (!trimmedKey) { setError('API key is required.'); return; }
    if (providerId !== 'anthropic' && !trimmedUrl) { setError('Base URL is required for this provider.'); return; }
    if (!trimmedModel) { setError('Model name is required.'); return; }

    setGuestConfig({ provider: providerId, key: trimmedKey, model: trimmedModel, baseUrl: trimmedUrl });
    onSave();
    onClose();
  };

  const handleClear = () => {
    clearGuestConfig();
    setKey('');
    onSave();
  };

  const showBaseUrl = providerId !== 'anthropic';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/50" onClick={onClose} />
      <div className="relative bg-paper border-2 border-zinc-900 rounded-lg w-full max-w-md p-6 shadow-2xl">

        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-orange-500/15 border border-orange-500/30 rounded flex items-center justify-center">
            <Key size={15} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Add your API key</h2>
            <p className="text-xs text-zinc-500">Stored locally in your browser only</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* Provider */}
          <div>
            <label className="block text-xs text-zinc-600 mb-1.5">Provider</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`py-2 px-3 rounded text-xs font-medium transition-all border ${
                    providerId === p.id
                      ? 'bg-zinc-900 border-zinc-900 text-paper'
                      : 'bg-white/60 border-zinc-900/20 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API key */}
          <div>
            <label className="block text-xs text-zinc-600 mb-1.5">API key</label>
            <div className="relative">
              <input
                type={visible ? 'text' : 'password'}
                value={key}
                onChange={e => { setKey(e.target.value); setError(''); }}
                placeholder={provider.keyHint}
                className={`${inputCls} pr-10`}
                autoFocus
              />
              <button
                onClick={() => setVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-zinc-600 mb-1.5">Model</label>
            <input
              type="text"
              value={model}
              onChange={e => { setModel(e.target.value); setError(''); }}
              placeholder={provider.defaultModel || 'model-name'}
              list={`models-${providerId}`}
              className={inputCls}
            />
            {provider.modelSuggestions.length > 0 && (
              <datalist id={`models-${providerId}`}>
                {provider.modelSuggestions.map(m => <option key={m} value={m} />)}
              </datalist>
            )}
          </div>

          {/* Base URL (non-Anthropic) */}
          {showBaseUrl && (
            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => { setBaseUrl(e.target.value); setError(''); }}
                placeholder="https://api.openai.com/v1"
                className={inputCls}
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <p className="text-xs text-zinc-500 leading-relaxed">
            Your key is saved in <code className="font-mono">localStorage</code> and sent directly to the provider via our proxy — we do not store it.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-700 text-paper text-sm font-medium rounded transition-colors"
            >
              Save
            </button>
            {existing?.key && (
              <button
                onClick={handleClear}
                className="px-4 py-2 border border-zinc-900/20 text-zinc-500 hover:border-red-600 hover:text-red-600 text-sm rounded transition-colors"
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
