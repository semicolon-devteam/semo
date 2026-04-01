interface KBDomain {
  domain: string;
  description?: string;
  entry_count: number;
}

interface DomainCardProps {
  domain: KBDomain;
  icon: string;
  onClick: () => void;
}

export default function DomainCard({ domain, icon, onClick }: DomainCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md cursor-pointer transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {domain.domain}
            </h3>
            {domain.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {domain.description}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">항목</span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          {domain.entry_count}
        </span>
      </div>
    </div>
  );
}
