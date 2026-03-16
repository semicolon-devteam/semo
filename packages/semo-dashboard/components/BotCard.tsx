/**
 * @file components/BotCard.tsx
 * @description 봇 1개를 카드 형태로 표시하는 재사용 컴포넌트.
 *   상태 색상, 마지막 활동 시간 포맷, 봇 상세 페이지 링크를 포함한다.
 * @module components
 */

import Link from 'next/link';
import type { Bot } from '@/types';

/** BotCard 컴포넌트 Props */
interface BotCardProps {
  /** 렌더링할 봇 데이터 */
  bot: Bot;
  /** 카드 클릭 시 호출되는 선택적 핸들러 (Link 이동 전에 실행) */
  onClick?: () => void;
}

/**
 * ISO 타임스탬프를 한국 표기 날짜/시간으로 변환한다.
 *
 * @param iso - ISO 8601 타임스탬프 문자열
 * @returns "MM/DD HH:mm" 형식 문자열, 잘못된 타임스탬프면 '-'
 * @example
 * formatLastActive('2026-03-15T10:30:00Z') // "03/15 10:30"
 * formatLastActive('invalid') // '-'
 */
function formatLastActive(iso: string): string {
  // Invalid timestamp인 경우 '-' 반환
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 봇 상태별 dot 색상 (Tailwind 클래스) */
const statusColors: Record<Bot['status'], string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
};

/** 봇 상태별 표시 텍스트 */
const statusLabels: Record<Bot['status'], string> = {
  online: '● Online',
  offline: '○ Offline',
};

/**
 * @component BotCard
 * @description 봇 1개를 카드로 표시. 이름·역할·상태·세션 수·마지막 활동 포함.
 *   클릭 시 `/bots/{bot.id}` 상세 페이지로 이동.
 *
 * @example
 * <BotCard bot={bot} />
 * <BotCard bot={bot} onClick={() => console.log('clicked')} />
 */
export default function BotCard({ bot, onClick }: BotCardProps) {
  return (
    <Link href={`/bots/${bot.id}`} onClick={onClick}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-label={`${bot.name} 이모지`}>{bot.emoji}</span>
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
            <span className="font-medium">{formatLastActive(bot.lastActive)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
