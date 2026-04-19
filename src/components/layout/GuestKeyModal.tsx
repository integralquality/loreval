import { useState } from 'react';
import { X, Eye, EyeOff, Key } from 'lucide-react';
import { getGuestKey, setGuestKey, clearGuestKey } from '../../lib/guestKey';

interface Props {
  onClose: () => void;
  onSave: () => void;
}

export function GuestKeyModal({ onClose, onSave }: Props) {
  const [value, setValue] = useState(getGuestKey() ?? '');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = value.trim();
    if (!trimmed) { setError('Enter a key first.'); return; }
    if (!trimmed.startsWith('sk-ant-')) { setError('Anthropic keys start with sk-ant-'); return; }
    setGuestKey(trimmed);
    onSave();
    onClose();
  };

  const handleClear = () => {
    clearGuestKey();
    setValue('');
    onSave();
  };

  const hasExisting = !!getGuestKey();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">

        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Key size={15} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Use your Anthropic key</h2>
            <p className="text-xs text-zinc-500">Stored locally in your browser — never sent to our servers</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={e => { setValue(e.target.value); setError(''); }}
              placeholder="sk-ant-..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-purple-500 transition-colors"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button
              onClick={() => setVisible(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {visible ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <p className="text-xs text-zinc-600 leading-relaxed">
            Get a key at{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-purple-300 underline transition-colors">
              console.anthropic.com
            </a>
            . The key is saved in <code className="font-mono">localStorage</code> and sent directly to Anthropic via our API proxy — we do not store it.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save key
            </button>
            {hasExisting && (
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
