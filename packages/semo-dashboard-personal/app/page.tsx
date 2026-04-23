import Link from 'next/link';
import { getStatus } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  const status = getStatus();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">SEMO Personal</h1>
        <p className="text-gray-600 dark:text-gray-400">{status.semoHome}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Card
          href="/bots"
          title="봇"
          desc="로컬 Claude 세션 기반 봇 현황"
          ready={status.opsExists}
        />
        <Card
          href="/kb"
          title="Knowledge Base"
          desc="SQLite KB 도메인 + 엔트리"
          ready={status.kbExists}
        />
        <Card
          href="/action-items"
          title="액션 아이템"
          desc="할 일 목록 + 일정"
          ready={status.opsExists}
        />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">상태</div>
        <ul className="text-blue-800 dark:text-blue-200 space-y-0.5">
          <li>
            SEMO_HOME: <code className="text-xs">{status.semoHome}</code>
          </li>
          <li>
            kb.db: {status.kbExists ? '있음' : '없음'} ({status.kbPath})
          </li>
          <li>
            ops.db: {status.opsExists ? '있음' : '없음'} ({status.opsPath})
          </li>
        </ul>
      </div>
    </div>
  );
}

function Card({
  href,
  title,
  desc,
  ready,
}: {
  href: string;
  title: string;
  desc: string;
  ready: boolean;
}) {
  return (
    <Link
      href={href}
      className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            ready
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {ready ? 'ready' : 'empty'}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{desc}</p>
    </Link>
  );
}
