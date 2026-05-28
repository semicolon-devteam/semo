'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';
import { listPersonaMeta } from '@/lib/customer/persona/registry';

/**
 * 모드 토글 — 고객 셸 Topbar용. 팀원에게만 보인다(외부 고객/비로그인은 숨김).
 *
 * - 어드민: 모든 모드 — 페르소나(가게/개인/직장인) 미리보기 + 운영팀(내부 툴).
 *   페르소나는 /my/personas?p= 로 미리보고, 운영팀은 기존 내부 대시보드(/)로.
 * - 비어드민 팀원: 내 가게 ↔ 운영팀.
 * - 외부 고객: 스위처 없음(자기 페르소나 고정 — 처음 선택값).
 */
const PERSONAS = listPersonaMeta();

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: 3,
  background: 'var(--semo-surface-2)',
  borderRadius: 'var(--r-10)',
  border: '1px solid var(--semo-line)',
  gap: 2,
};

function pillStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 'var(--r-8)',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: selected ? 'var(--semo-surface)' : 'transparent',
    color: selected ? 'var(--semo-fg-1)' : 'var(--semo-fg-3)',
    boxShadow: selected ? 'var(--semo-shadow-1)' : 'none',
  };
}

export default function TeamModeToggle() {
  const { profile, isAdmin, loading } = useAuth();
  const router = useRouter();

  // 팀원만(프로필 보유). 로딩/외부 고객/비로그인은 숨김.
  if (loading || !profile) return null;

  if (isAdmin) {
    // 어드민 — 모든 모드. 페르소나 미리보기 + 운영팀.
    return (
      <div style={containerStyle} aria-label="모드 전환 (어드민)">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => router.push(`/my/personas?p=${p.id}`)}
            style={pillStyle(false)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{ ...pillStyle(false), color: 'var(--semo-ai)' }}
        >
          운영팀
        </button>
      </div>
    );
  }

  // 비어드민 팀원 — 내 가게 ↔ 운영팀.
  return (
    <div style={containerStyle} aria-label="모드 전환">
      <button type="button" aria-current="page" style={pillStyle(true)}>
        내 가게
      </button>
      <button type="button" onClick={() => router.push('/')} style={pillStyle(false)}>
        운영팀
      </button>
    </div>
  );
}
