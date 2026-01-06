'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Semo Office</h1>
      <p className="text-xl text-gray-400 mb-12">
        GatherTown 스타일 멀티에이전트 협업 워크스페이스
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        <Link
          href="/office/demo"
          className="group rounded-lg border border-gray-700 px-5 py-4 transition-colors hover:border-gray-500 hover:bg-gray-800"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Demo Office{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 text-sm text-gray-400">
            데모 오피스에서 Agent들의 협업을 체험해보세요.
          </p>
        </Link>

        <Link
          href="/office/new"
          className="group rounded-lg border border-gray-700 px-5 py-4 transition-colors hover:border-gray-500 hover:bg-gray-800"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            New Office{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 text-sm text-gray-400">
            새 오피스를 생성하고 GitHub 레포와 연결하세요.
          </p>
        </Link>
      </div>

      <div className="mt-16 text-center">
        <h3 className="text-lg font-semibold mb-4">지원하는 Agent 역할</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { role: 'PO', color: 'bg-agent-po' },
            { role: 'FE', color: 'bg-agent-fe' },
            { role: 'BE', color: 'bg-agent-be' },
            { role: 'QA', color: 'bg-agent-qa' },
            { role: 'DevOps', color: 'bg-agent-devops' },
          ].map(({ role, color }) => (
            <span
              key={role}
              className={`${color} px-3 py-1 rounded-full text-sm font-medium`}
            >
              {role}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
