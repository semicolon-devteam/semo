import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './(customer)/_ui/tokens.css';
import './globals.css';
import AppChrome from '@/components/AppChrome';
import { AuthProvider } from '@/lib/auth/provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'SemiColony 대시보드',
  description: 'AI 봇 오케스트레이션 모니터링 + KB/벡터 DB 관리',
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/softphone/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased dark:bg-gray-900`}>
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
