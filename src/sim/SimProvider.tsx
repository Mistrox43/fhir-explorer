import { useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import {
  clearStoredFacility,
  emptyFacility,
  facilityReducer,
  loadFacility,
  sampleFacility,
  saveFacility,
} from './state';
import { SimContext } from './simContext';
import type { SimContextValue } from './simContext';

export function SimProvider({ children }: { children: ReactNode }) {
  const [facility, dispatch] = useReducer(
    facilityReducer,
    undefined,
    () => loadFacility() ?? emptyFacility(),
  );

  // Persist on every change (synthetic data, local-only).
  useEffect(() => {
    saveFacility(facility);
  }, [facility]);

  const value = useMemo<SimContextValue>(
    () => ({
      facility,
      commit: (entity) => dispatch({ type: 'commit', entity }),
      remove: (kind, key) => dispatch({ type: 'remove', kind, key }),
      reset: () => {
        clearStoredFacility();
        dispatch({ type: 'reset' });
      },
      seed: () => dispatch({ type: 'replace', state: sampleFacility() }),
    }),
    [facility],
  );

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}
