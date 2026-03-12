'use client';

import { useState } from 'react';
import Header from './Header';
import OrderZone from './OrderZone';
import OfficeView from './OfficeView';
import Monitor from './Monitor';

export default function DashboardLayout() {
  const [isMonitorCollapsed, setIsMonitorCollapsed] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content: 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Order Zone */}
        <OrderZone />

        {/* Main Canvas - Office View */}
        <OfficeView />

        {/* Right Panel - Monitor */}
        <Monitor
          isCollapsed={isMonitorCollapsed}
          onToggleCollapse={() => setIsMonitorCollapsed(!isMonitorCollapsed)}
        />
      </div>
    </div>
  );
}
