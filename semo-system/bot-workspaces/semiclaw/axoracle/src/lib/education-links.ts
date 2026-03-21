/**
 * Education Links — DB-backed (Phase 2)
 * Fetches from education_links table, with client-side caching
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface EducationLink {
  id: string;
  title: string;
  provider: string;
  url: string;
  icon: string;
  tag: string | null;
  affiliate_url: string | null;
  click_count: number;
}

type Lang = 'ko' | 'en' | 'ja';

/**
 * Get education links for given task categories + language
 * Queries DB: category-specific + _general fallback
 * Returns max 5 links, sorted by sort_order
 */
export async function getEducationLinks(
  taskCategories: string[],
  lang: Lang
): Promise<EducationLink[]> {
  const categories = [...taskCategories, '_general'];

  const { data, error } = await supabase
    .from('education_links')
    .select('id, title, provider, url, icon, tag, affiliate_url, click_count, sort_order')
    .in('task_category', categories)
    .eq('lang', lang)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch education links:', error);
    return [];
  }

  // Deduplicate by URL, keep first (lower sort_order)
  const seen = new Set<string>();
  const links: EducationLink[] = [];
  for (const row of data || []) {
    if (!seen.has(row.url)) {
      seen.add(row.url);
      links.push({
        id: row.id,
        title: row.title,
        provider: row.provider,
        url: row.url,
        icon: row.icon,
        tag: row.tag,
        affiliate_url: row.affiliate_url,
        click_count: row.click_count,
      });
    }
  }

  return links.slice(0, 5);
}

/**
 * Track a click on an education link (client-side)
 */
export async function trackEducationClick(linkId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('track_education_click', { link_id: linkId });
  if (error) {
    console.error('Failed to track click:', error);
    return null;
  }
  return (data as { url: string })?.url || null;
}
