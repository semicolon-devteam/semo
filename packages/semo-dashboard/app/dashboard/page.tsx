/**
 * @file app/dashboard/page.tsx
 * @description 메인 대시보드 페이지. DashboardLayout(Header + BotOverview)을 렌더링한다.
 * @route /dashboard
 * @renderMode CSR (DashboardLayout이 'use client' 컴포넌트)
 */

import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function DashboardPage() {
  return <DashboardLayout />;
}
