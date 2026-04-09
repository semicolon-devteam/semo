'use client';

import type { ServiceProject } from '@/types';
import type { ServiceOverviewKB } from '@/lib/service';
import ReactMarkdown from 'react-markdown';

interface Props {
  project: ServiceProject;
  kb: ServiceOverviewKB;
}

function InfoCard({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:underline break-all"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}

function MarkdownSection({ title, content }: { title: string; content: string | null }) {
  if (!content) return null;
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h3>
      <div className="prose prose-sm prose-invert max-w-none text-zinc-300">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

export default function ServiceOverviewTab({ project, kb }: Props) {
  // Parse first line of base-information as description
  const description = kb.baseInformation?.split('\n').slice(0, 3).join('\n');

  return (
    <div className="space-y-6">
      {/* Project Info Grid */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">프로젝트 정보</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoCard label="담당자 (PO)" value={kb.po} />
          <InfoCard label="서비스 URL" value={kb.serviceUrl} href={kb.serviceUrl ?? undefined} />
          <InfoCard
            label="GitHub Repo"
            value={kb.repo}
            href={
              kb.repo?.startsWith('http')
                ? kb.repo
                : kb.repo
                  ? `https://github.com/${kb.repo}`
                  : undefined
            }
          />
          <InfoCard label="Slack 채널" value={kb.slackChannel} />
          <InfoCard label="기술 스택" value={kb.techStack} />
          <InfoCard label="비즈니스 모델" value={kb.bm} />
        </div>
      </div>

      {/* Description */}
      {description && <MarkdownSection title="서비스 설명" content={description} />}

      {/* Current Situation */}
      <MarkdownSection title="현재 상황" content={kb.currentSituation} />

      {/* Infrastructure */}
      <MarkdownSection title="인프라 구성" content={kb.infra} />
    </div>
  );
}
