'use client';

import { useState, useEffect } from 'react';
import type { ServiceProject, ServiceFeature, ServiceKPIMetric, ServiceActionItem } from '@/types';
import type { ServiceOverviewKB } from '@/lib/service';
import ServiceOverviewTab from './ServiceOverviewTab';
import ServiceSprintTab from './ServiceSprintTab';
import type { SprintTabData } from './ServiceSprintTab';
import ServiceFeaturesTab from './ServiceFeaturesTab';

type OpsTab = 'overview' | 'sprint' | 'features';

interface ServiceOpsViewProps {
  projectId: string;
}

interface OverviewData {
  project: ServiceProject;
  kb: ServiceOverviewKB;
}

interface KBKPIData {
  kpiSnapshots: Array<{ subKey: string; content: string; updatedAt: string }>;
  actionItems: Array<{ subKey: string; content: string; updatedAt: string }>;
  milestones: Array<{ subKey: string; content: string; metadata: Record<string, unknown> }>;
  incidents: Array<Record<string, unknown>>;
}

interface DBKPIMetricsData {
  metrics: ServiceKPIMetric[];
  periods: string[];
  latestPeriod: string | null;
}

export default function ServiceOpsView({ projectId }: ServiceOpsViewProps) {
  const [activeTab, setActiveTab] = useState<OpsTab>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [kbKpiData, setKbKpiData] = useState<KBKPIData | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DBKPIMetricsData | null>(null);
  const [dbActionItems, setDbActionItems] = useState<ServiceActionItem[]>([]);
  const [features, setFeatures] = useState<ServiceFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, kpiRes, metricsRes, actionsRes, featRes] = await Promise.all([
        fetch(`/api/gfp/${projectId}/overview`),
        fetch(`/api/gfp/${projectId}/kpi?limit=10`),
        fetch(`/api/gfp/${projectId}/kpi-metrics`),
        fetch(`/api/gfp/${projectId}/service-action-items`),
        fetch(`/api/gfp/${projectId}/features`),
      ]);
      if (ovRes.ok) setOverview(await ovRes.json());
      if (kpiRes.ok) setKbKpiData(await kpiRes.json());
      if (metricsRes.ok) setDbMetrics(await metricsRes.json());
      if (actionsRes.ok) setDbActionItems(await actionsRes.json());
      if (featRes.ok) setFeatures(await featRes.json());
    } catch (err) {
      console.error('Failed to load ops data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const refreshFeatures = async () => {
    const res = await fetch(`/api/gfp/${projectId}/features`);
    if (res.ok) setFeatures(await res.json());
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-600 border-t-blue-500 rounded-full mb-2" />
        <p>서비스 데이터 로딩 중...</p>
      </div>
    );
  }

  if (!overview) {
    return <div className="p-8 text-center text-red-400">서비스 데이터를 불러올 수 없습니다.</div>;
  }

  const project = overview.project;
  const lifecycleBadge =
    project.lifecycle === 'ops'
      ? { label: '운영 중', color: 'bg-green-600' }
      : { label: '종료', color: 'bg-zinc-600' };

  const tabs: { key: OpsTab; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'sprint', label: '스프린트 & KPI' },
    {
      key: 'features',
      label: `기능 관리 (${features.filter((f) => f.status !== 'deprecated').length})`,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <a href="/gfp" className="hover:text-zinc-200">
            서비스
          </a>
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{project.project_name}</h1>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium text-white ${lifecycleBadge.color}`}
          >
            {lifecycleBadge.label}
          </span>
          {project.status === 'paused' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium text-yellow-300 bg-yellow-900/50">
              일시정지
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400 mt-1">
          오너: {project.owner_name}
          {project.service_domain && <> | 도메인: {project.service_domain}</>}
          {project.launched_at && (
            <> | 운영 시작: {new Date(project.launched_at).toLocaleDateString('ko-KR')}</>
          )}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-zinc-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <ServiceOverviewTab project={project} kb={overview.kb} />}
      {activeTab === 'sprint' && kbKpiData && (
        <ServiceSprintTab
          data={
            {
              metrics: dbMetrics?.metrics,
              periods: dbMetrics?.periods,
              latestPeriod: dbMetrics?.latestPeriod,
              actionItems: dbActionItems.length > 0 ? dbActionItems : undefined,
              kpiSnapshots: kbKpiData.kpiSnapshots,
              actionItemsRaw: kbKpiData.actionItems,
              milestones: kbKpiData.milestones,
              incidents: kbKpiData.incidents,
              projectId,
            } satisfies SprintTabData
          }
          onRefresh={loadData}
        />
      )}
      {activeTab === 'features' && (
        <ServiceFeaturesTab
          projectId={projectId}
          features={features}
          onRefresh={refreshFeatures}
          serviceDomain={project.service_domain}
        />
      )}
    </div>
  );
}
