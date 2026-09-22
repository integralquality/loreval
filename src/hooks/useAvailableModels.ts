import { useEffect, useState } from 'react';
import { CREDENTIALS_CHANGED_EVENT, availableModels } from '../lib/credentials';
import type { QualifiedModel } from '../lib/providers';

/**
 * Models the user can run right now, kept in sync when keys are added or
 * removed — including from another tab.
 */
export function useAvailableModels(): QualifiedModel[] {
  const [models, setModels] = useState<QualifiedModel[]>(() => availableModels());

  useEffect(() => {
    const sync = () => setModels(availableModels());
    window.addEventListener(CREDENTIALS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CREDENTIALS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return models;
}
