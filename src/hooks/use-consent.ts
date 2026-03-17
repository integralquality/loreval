import { useState, useCallback } from 'react';
import { getConsent, setConsent, type ConsentState } from '@/lib/consent';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useConsent() {
  const [consent, setConsentState] = useState<ConsentState>(getConsent);
  const { user } = useAuth();

  const updateConsent = useCallback(
    async (choices: { analytics: boolean; marketing: boolean }) => {
      const state = setConsent(choices);
      setConsentState(state);

      // Sync to database for logged-in users
      if (user) {
        await supabase.from('consent_preferences').upsert(
          {
            user_id: user.id,
            analytics: choices.analytics,
            marketing: choices.marketing,
            consented_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      }

      return state;
    },
    [user],
  );

  const acceptAll = useCallback(
    () => updateConsent({ analytics: true, marketing: true }),
    [updateConsent],
  );

  const rejectAll = useCallback(
    () => updateConsent({ analytics: false, marketing: false }),
    [updateConsent],
  );

  return {
    consent,
    updateConsent,
    acceptAll,
    rejectAll,
    showBanner: !consent.decided,
  };
}
