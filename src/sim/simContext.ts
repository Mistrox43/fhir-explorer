import { createContext, useContext } from 'react';
import type { FacilityState } from './state';
import type { EntityKind, SimEntity } from './types';

export interface SimContextValue {
  facility: FacilityState;
  /** Add or update an entity (keyed by kind + key). */
  commit: (entity: SimEntity) => void;
  remove: (kind: EntityKind, key: string) => void;
  /** Empty the facility (and clear persisted state). */
  reset: () => void;
  /** Replace the facility with a ready-made sample. */
  seed: () => void;
}

export const SimContext = createContext<SimContextValue | null>(null);

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used within SimProvider');
  return ctx;
}
