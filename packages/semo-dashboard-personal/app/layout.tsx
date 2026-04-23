import type { Metadata } from 'next';
import './globals.css';
import PersonalNav from '@/components/PersonalNav';

export const metadata: Metadata = {
  title: 'SEMO Personal Dashboard',
  description: '로컬 봇 워크스페이스와 SQLite KB를 위한 개인 대시보드',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gray-50 dark:bg-gray-900">
        <PersonalNav />
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  );
}
