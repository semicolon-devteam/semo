import type { Bot } from '@/types';

interface BotCardProps {
  bot: Bot;
  onClick?: () => void;
}

export default function BotCard({ bot, onClick }: BotCardProps) {
  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  const statusLabels = {
    active: '🟢 Active',
    idle: '🟡 Idle',
    error: '🔴 Error',
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{bot.emoji}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {bot.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {bot.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[bot.status]}`} />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {statusLabels[bot.status]}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Sessions</span>
          <span className="font-medium">{bot.sessionCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 dark:text-gray-400">Last Active</span>
          <span className="font-medium">
            {new Date(bot.lastActive).toLocaleString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
