/**
 * @file components/BotCard.tsx
 * @description 봇 상태 카드 컴포넌트 (대시보드 메인)
 * @dependencies Next.js Link, Bot 타입
 * @usage
 * import BotCard from '@/components/BotCard';
 * <BotCard bot={botData} onClick={() => handleClick()} />
 */

import Link from 'next/link';
import type { Bot } from '@/types';

/**
 * BotCard 컴포넌트 Props
 */
interface BotCardProps {
  /** 
   * 봇 정보 객체
   * @required
   * @example { id: 'abc', name: 'WorkClaw', status: 'online', ... }
   */
  bot: Bot;

  /**
   * 카드 클릭 시 호출될 콜백 (선택적)
   * @optional
   * @example onClick={() => console.log('Bot clicked')}
   */
  onClick?: () => void;
}

/**
 * 봇 상태 카드
 * 
 * @description
 * 개별 봇의 현재 상태를 카드 형태로 표시하는 컴포넌트.
 * 다음 정보를 포함:
 * - 봇 이름, 역할, 이모지
 * - 온라인/오프라인 상태 (실시간)
 * - 활성 세션 수
 * - 마지막 활동 시간
 * 
 * 카드 클릭 시 봇 상세 페이지로 이동 (/bots/[id])
 * 
 * @component
 * @param props - BotCardProps
 * @returns JSX.Element - 봇 카드 UI
 * 
 * @example
 * // 기본 사용
 * <BotCard bot={{ 
 *   id: 'abc123',
 *   name: 'WorkClaw',
 *   role: 'Developer',
 *   status: 'online',
 *   sessionCount: 5,
 *   lastActive: '2026-03-15T12:00:00Z',
 *   emoji: '🛠️'
 * }} />
 * 
 * @example
 * // onClick 핸들러 포함
 * <BotCard
 *   bot={botData}
 *   onClick={() => trackEvent('bot_card_clicked')}
 * />
 */
export default function BotCard({ bot, onClick }: BotCardProps) {
  /**
   * 상태별 배경색 매핑
   * @constant
   */
  const statusColors: Record<Bot['status'], string> = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
  };

  /**
   * 상태별 라벨 텍스트
   * @constant
   */
  const statusLabels: Record<Bot['status'], string> = {
    online: '● Online',
    offline: '○ Offline',
  };

  /**
   * 마지막 활동 시간 포맷팅
   * 
   * @description
   * ISO timestamp를 한국 로케일 (MM/DD HH:MM) 형식으로 변환
   * 
   * @param timestamp - ISO 8601 타임스탬프
   * @returns 포맷된 시간 문자열 (예: "03/15 14:30")
   */
  const formatLastActive = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      /**
       * 에러 처리: 잘못된 타임스탬프 형식
       * - 로그 출력
       * - 기본값 "N/A" 반환
       */
      console.error('Invalid timestamp format:', timestamp, error);
      return 'N/A';
    }
  };

  return (
    <Link href={`/bots/${bot.id}`} onClick={onClick}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer">
        {/* 헤더: 봇 정보 + 상태 인디케이터 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* 봇 이모지 */}
            <span className="text-4xl" aria-label={`${bot.name} emoji`}>
              {bot.emoji}
            </span>

            {/* 봇 이름 + 역할 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {bot.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {bot.role}
              </p>
            </div>
          </div>

          {/* 상태 인디케이터 */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${statusColors[bot.status]}`}
              aria-label={`Status: ${bot.status}`}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {statusLabels[bot.status]}
            </span>
          </div>
        </div>

        {/* 메트릭: 세션 수 + 마지막 활동 시간 */}
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {/* 세션 수 */}
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Sessions</span>
            <span className="font-medium">{bot.sessionCount}</span>
          </div>

          {/* 마지막 활동 시간 */}
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Last Active</span>
            <span className="font-medium">
              {formatLastActive(bot.lastActive)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
