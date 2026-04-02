'use client';

import { createContext, useContext } from 'react';
import type { PoProfile } from '@/types';
import { DEFAULT_PO_PROFILE } from '@/lib/po-profile';

const PoProfileContext = createContext<PoProfile>(DEFAULT_PO_PROFILE);

export const PoProfileProvider = PoProfileContext.Provider;

export function usePoProfile(): PoProfile {
  return useContext(PoProfileContext);
}
