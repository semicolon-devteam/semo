import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import LanguageSelector from "@/components/LanguageSelector";
import HeaderExchangeRate from "@/components/HeaderExchangeRate";
import FeedbackButton from "@/components/FeedbackButton";
import { LangProvider } from "@/lib/i18n";
import { OrganizationJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL('https://axoracle.com'),
  title: {
    default: 'AXOracle - AI가 당신의 직업을 대체할 확률은?',
    template: '%s | AXOracle',
  },
  description: '3개국 30개 IT 직종의 AI 대체 위험도를 데이터 기반으로 분석합니다.',
  keywords: ['AI 직업 대체', 'AI 대체율', 'AI job replacement', '직업 자동화', 'AI仕事の代替', '인공지능 직업'],
  authors: [{ name: 'AXOracle' }],
  creator: 'AXOracle',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    alternateLocale: ['en_US', 'ja_JP'],
    siteName: 'AXOracle',
    title: 'AXOracle - AI가 당신의 직업을 대체할 확률은?',
    description: '3개국 30개 IT 직종의 AI 대체 위험도를 데이터 기반으로 분석합니다.',
    images: ['/api/og?default=true'],
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://axoracle.com',
    languages: {
      'ko': 'https://axoracle.com',
      'en': 'https://axoracle.com?lang=en',
      'ja': 'https://axoracle.com?lang=ja',
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="light">
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body>
        <OrganizationJsonLd />
        <LangProvider>
          <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center">
                <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">AXOracle</Link>
                <FeedbackButton />
              </div>
              <div className="flex items-center">
                <HeaderExchangeRate />
                <LanguageSelector />
              </div>
            </div>
          </nav>

          <main className="container mx-auto px-4 py-8">
            {children}
          </main>

          <footer className="border-t mt-12">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-600">
              © 2026 AXOracle. 데이터 출처: 사람인, BLS, O*NET
            </div>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
