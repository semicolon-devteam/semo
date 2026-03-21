'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function CountryPageTracker({ country }: { country: string }) {
  useEffect(() => {
    trackEvent({ event_type: 'page_view', country });
  }, [country]);

  return null;
}
