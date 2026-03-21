import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase/client'

const BASE_URL = 'https://axoracle.com'
const COUNTRIES = ['kr', 'us', 'jp'] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all occupations
  const { data: occupations } = await supabase
    .from('occupations')
    .select('id, updated_at')

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...COUNTRIES.map((country) => ({
      url: `${BASE_URL}/${country}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
  ]

  // Occupation pages for all countries
  const occupationPages: MetadataRoute.Sitemap = (occupations || []).flatMap((occ) =>
    COUNTRIES.map((country) => ({
      url: `${BASE_URL}/${country}/${occ.id}`,
      lastModified: occ.updated_at ? new Date(occ.updated_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  )

  return [...staticPages, ...occupationPages]
}
