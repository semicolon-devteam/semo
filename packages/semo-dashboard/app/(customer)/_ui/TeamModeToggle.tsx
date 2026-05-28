'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

/**
 * 내 가게(고객) ↔ 운영팀(내부 툴) 모드 토글 — 고객 셸 Topbar용.
 *
 * 팀원(user_profiles 보유)에게만 보인다. 외부 고객/비로그인은 렌더 안 함.
 * '운영팀' = 기존 내부 대시보드(/)로 이동(경량 통합 — 운영팀 모드는 기존 툴 재사용).
 * '내 가게' = 현재 위치(/my). 시각 스타일은 디자인 셸의 2-pill 토글을 그대로 따른다.
 */
export default function TeamModeToggle() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  // 팀원만(프로필 보유). 로딩/외부 고객/비로그인은 숨김.
  if (loading || !profile) return null;

  const pillBase: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 'var(--r-8)',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 3,
        background: 'var(--semo-surface-2)',
        borderRadius: 'var(--r-10)',
        border: '1px solid var(--semo-line)',
        gap: 2,
      }}
    >
      <button
        type="button"
        aria-current="page"
        style={{
          ...pillBase,
          background: 'var(--semo-surface)',
          color: 'var(--semo-fg-1)',
          boxShadow: 'var(--semo-shadow-1)',
        }}
      >
        내 가게
      </button>
      <button
        type="button"
        onClick={() => router.push('/')}
        style={{ ...pillBase, background: 'transparent', color: 'var(--semo-fg-3)' }}
      >
        운영팀
      </button>
    </div>
  );
}
