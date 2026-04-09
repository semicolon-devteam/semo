'use client';

import type { ServiceInfraConfig, ServicePresetConfig } from '@/types';

interface GfpPresetInfoPanelProps {
  metadata: Record<string, unknown>;
}

export default function GfpPresetInfoPanel({ metadata }: GfpPresetInfoPanelProps) {
  const preset = metadata?.preset as string | undefined;
  if (!preset || preset === 'standard') return null;

  const config = metadata?.preset_config as ServicePresetConfig | undefined;

  if (preset === 'infra-ready' && config?.infra) {
    return <InfraReadyPanel infra={config.infra} />;
  }

  return null;
}

function InfraReadyPanel({ infra }: { infra: ServiceInfraConfig }) {
  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
      <h3 className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-3">
        사전 구축 인프라
      </h3>
      <div className="space-y-2 text-sm">
        {infra.repo_url && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Repo</span>
            <a
              href={infra.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              {infra.repo_url.replace('https://github.com/', '')}
            </a>
          </div>
        )}
        {infra.live_url && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Live</span>
            <a
              href={infra.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              {infra.live_url.replace(/^https?:\/\//, '')}
            </a>
          </div>
        )}
        {infra.deploy_pipeline && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">CI/CD</span>
            <p className="text-gray-700 dark:text-gray-300">{infra.deploy_pipeline}</p>
          </div>
        )}
        {infra.dns_configured !== undefined && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">DNS</span>
            <p className="text-gray-700 dark:text-gray-300">
              {infra.dns_configured ? 'Configured' : 'Pending'}
            </p>
          </div>
        )}
        {infra.provisioned_by && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Provisioned by</span>
            <p className="text-gray-700 dark:text-gray-300">{infra.provisioned_by}</p>
          </div>
        )}
      </div>
    </div>
  );
}
