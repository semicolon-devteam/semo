/**
 * JSON-LD Structured Data Components for SEO
 * @see https://schema.org
 */

const BASE_URL = 'https://axoracle.com'

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AXOracle',
    description: 'AI 직업 대체 위험도 분석 플랫폼 - AI Job Replacement Risk Analysis Platform',
    url: BASE_URL,
    logo: `${BASE_URL}/api/og?default=true`,
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface WebPageJsonLdProps {
  title: string
  description: string
  url: string
}

export function WebPageJsonLd({ title, description, url }: WebPageJsonLdProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'AXOracle',
      url: BASE_URL,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

interface OccupationJsonLdProps {
  name: string
  nameEn: string
  description: string
  url: string
  salary?: {
    amount: number
    currency: string
  }
  riskScore: number
}

export function OccupationJsonLd({
  name,
  nameEn,
  description,
  url,
  salary,
  riskScore,
}: OccupationJsonLdProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Occupation',
    name: nameEn,
    alternateName: name,
    description,
    url,
    ...(salary && {
      estimatedSalary: {
        '@type': 'MonetaryAmountDistribution',
        currency: salary.currency,
        median: salary.amount,
      },
    }),
    additionalProperty: {
      '@type': 'PropertyValue',
      name: 'AI Replacement Risk Score',
      value: `${riskScore.toFixed(1)}%`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
