import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import GlobalNav from '@/components/GlobalNav';
import OnboardingGate from '@/components/OnboardingGate';
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
  title: 'SEMO 대시보드',
  description: 'AI 봇 오케스트레이션 모니터링 + KB/벡터 DB 관리',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-900`}
      >
        <AuthProvider>
          <OnboardingGate>
            <GlobalNav />
            <main className="min-h-screen pt-16">{children}</main>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
