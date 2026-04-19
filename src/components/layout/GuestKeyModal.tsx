import { useState } from 'react';
import { X, Eye, EyeOff, Key } from 'lucide-react';
import { getGuestConfig, setGuestConfig, clearGuestConfig, PROVIDERS } from '../../lib/guestKey';

interface Props {
  onClose: () => void;
  onSave: () => void;
}

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">

        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Key size={15} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Add your API key</h2>
            <p className="text-xs text-zinc-500">Stored locally in your browser only</p>
          </div>
        </div>

        <div className="space-y-4">

          {/* Provider */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Provider</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                    providerId === p.id
                      ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API key */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">API key</label>
            <div className="relative">
              <input
                type={visible ? 'text' : 'password'}
                value={key}
                onChange={e => { setKey(e.target.value); setError(''); }}
                placeholder={provider.keyHint}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500 transition-colors"
                autoFocus
              />
              <button
                onClick={() => setVisible(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {visible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Model</label>
            <input
              type="text"
              value={model}
              onChange={e => { setModel(e.target.value); setError(''); }}
              placeholder={provider.defaultModel || 'model-name'}
              list={`models-${providerId}`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500 transition-colors"
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
              <label className="block text-xs text-zinc-400 mb-1.5">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => { setBaseUrl(e.target.value); setError(''); }}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <p className="text-xs text-zinc-600 leading-relaxed">
            Your key is saved in <code className="font-mono">localStorage</code> and sent directly to the provider via our proxy — we do not store it.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            {existing?.key && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 text-sm rounded-lg transition-colors"
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
