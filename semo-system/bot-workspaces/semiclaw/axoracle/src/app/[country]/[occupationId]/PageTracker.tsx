'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function PageTracker({
  country,
  occupationId,
  occupationName,
  riskScore,
}: {
  country: string;
  occupationId: string;
  occupationName: string;
  riskScore: number;
}) {
  useEffect(() => {
    trackEvent({
      event_type: 'occupation_select',
      country,
      occupation_id: occupationId,
      occupation_name: occupationName,
      risk_score: riskScore,
    });
  }, [country, occupationId, occupationName, riskScore]);

  return null;
}
