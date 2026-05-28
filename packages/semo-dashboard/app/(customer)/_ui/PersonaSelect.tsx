'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { listPersonaMeta } from '@/lib/customer/persona/registry';
import type { PersonaId } from '@/lib/customer/persona/schema';

/**
 * 처음 모드(페르소나) 선택 — 가입/첫 진입 시 1회. 선택을 customer_user_settings 에
 * 저장한 뒤 /my 로 들어간다. (어드민은 셸 스위처로 모든 모드를 자유 전환.)
 */
const META = listPersonaMeta();

export default function PersonaSelect() {
  const [busy, setBusy] = useState<PersonaId | null>(null);
  const router = useRouter();

  async function choose(id: PersonaId) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/my/persona', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persona: id }),
      });
      if (res.ok) {
        router.push('/my');
        return;
      }
      setBusy(null);
    } catch {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        background: 'var(--semo-bg-soft)',
      }}
    >
      <div
        style={{ width: '100%', maxWidth: 720, display: 'grid', gap: 22, justifyItems: 'center' }}
      >
        <div style={{ textAlign: 'center', display: 'grid', gap: 6 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--semo-fg-1)',
              letterSpacing: '-0.02em',
            }}
          >
            어떤 일을 도와드릴까요?
          </div>
          <div style={{ fontSize: 14, color: 'var(--semo-fg-3)' }}>
            내 상황에 맞는 모드를 고르면 직원·지식·요금이 거기에 맞춰져요. 나중에 바꿀 수 있어요.
          </div>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%' }}
        >
          {META.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!!busy}
              onClick={() => choose(p.id)}
              style={{
                textAlign: 'left',
                padding: 20,
                background: 'var(--semo-surface)',
                border: '1.5px solid var(--semo-line)',
                borderRadius: 'var(--r-16)',
                boxShadow: 'var(--semo-shadow-1)',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && busy !== p.id ? 0.5 : 1,
                display: 'grid',
                gap: 8,
                minHeight: 132,
                alignContent: 'start',
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--semo-fg-1)' }}>
                {p.label}
              </div>
              {p.longLabel && (
                <div style={{ fontSize: 13, color: 'var(--semo-fg-3)', lineHeight: 1.55 }}>
                  {p.longLabel}
                </div>
              )}
              <div
                style={{
                  marginTop: 'auto',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--semo-primary)',
                }}
              >
                {busy === p.id ? '설정 중…' : '이걸로 시작 →'}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
