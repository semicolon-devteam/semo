'use client';

import { supabase } from '@/lib/supabase/client';

function getUTMParams(): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const val = params.get(key);
    if (val) result[key] = val;
  }
  return result;
}

export async function trackEvent(event: {
  event_type: string;
  country?: string;
  occupation_id?: string;
  occupation_name?: string;
  risk_score?: number;
  shared_via?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const utm = getUTMParams();
    await supabase.from('analytics_events').insert({
      ...event,
      ...utm,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  } catch {
    // silently fail — analytics should never break the app
  }
}
