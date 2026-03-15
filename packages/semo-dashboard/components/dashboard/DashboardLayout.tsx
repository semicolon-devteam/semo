'use client';

import Header from './Header';
import BotOverview from './BotOverview';

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
