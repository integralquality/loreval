import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from '@/hooks/use-consent';

export function CookieBanner() {
  const { showBanner, acceptAll, rejectAll, updateConsent } = useConsent();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!showBanner) return null;

  const btnBase = 'px-3 py-1.5 rounded text-sm font-medium transition-colors';
  const btnPrimary = `${btnBase} bg-zinc-100 hover:bg-zinc-300 text-paper`;
  const btnOutline = `${btnBase} border border-white/15 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100`;

  return (
    <div className="border-t border-white/15 bg-paper px-4 py-4">
      <div className="mx-auto max-w-page">
        {!showDetails ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              We use cookies to improve your experience. See our{' '}
              <Link to="/privacy" className="text-orange-400 hover:text-orange-300 underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <button className={btnOutline} onClick={() => setShowDetails(true)}>
                Customize
              </button>
              <button className={btnOutline} onClick={rejectAll}>
                Reject All
              </button>
              <button className={btnPrimary} onClick={acceptAll}>
                Accept All
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-zinc-100">Cookie Preferences</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Essential</p>
                  <p className="text-xs text-zinc-500">Required for the app to function. Always enabled.</p>
                </div>
                <input type="checkbox" checked disabled className="h-4 w-4 accent-zinc-300" />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Analytics</p>
                  <p className="text-xs text-zinc-500">Help us understand how you use the app.</p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="h-4 w-4 accent-zinc-300"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Marketing</p>
                  <p className="text-xs text-zinc-500">Allow us to send product updates and relevant content.</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="h-4 w-4 accent-zinc-300"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button className={btnOutline} onClick={() => setShowDetails(false)}>Back</button>
              <button className={btnPrimary} onClick={() => updateConsent({ analytics, marketing })}>
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
