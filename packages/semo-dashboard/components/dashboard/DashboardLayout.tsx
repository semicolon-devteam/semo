/**
 * @file components/dashboard/DashboardLayout.tsx
 * @description 대시보드 레이아웃 래퍼. Header와 BotOverview를 수직으로 배치한다.
 * @module components/dashboard
 */

'use client';

import Header from './Header';
import BotOverview from './BotOverview';

/**
 * @component DashboardLayout
 * @description 전체 화면 높이를 사용하는 대시보드 레이아웃.
 *   Header(상단 고정)와 BotOverview(스크롤 영역)로 구성된다.
 */
export default function DashboardLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 overflow-hidden">
        <BotOverview />
      </div>
    </div>
  );
}
