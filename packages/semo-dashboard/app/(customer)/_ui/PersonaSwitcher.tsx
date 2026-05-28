'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PersonaHome, PersonaLibrary, PersonaPlan } from './screen-persona';
import { listPersonaMeta } from '@/lib/customer/persona/registry';
import { isPersonaId, type PersonaId } from '@/lib/customer/persona/schema';

/**
 * Persona 미리보기 스위처 (클라이언트). persona 는 URL ?p= 에서 reactive 하게 읽는다
 * (useState 초기화 staleness 회피) — 어드민 셸 토글·여기 하단 pill 모두 ?p= 를 바꾸므로
 * 둘 다 즉시 콘텐츠에 반영된다. initial 은 서버 resolve 결과(저장값/fallback).
 * 라벨은 registry(JSON 정본).
 */
const PERSONA_META = listPersonaMeta();
const VIEWS = [
  { id: 'home', label: '홈' },
  { id: 'library', label: '채용' },
  { id: 'plan', label: '요금제' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];

export default function PersonaSwitcher({ initial }: { initial: PersonaId }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pParam = sp.get('p');
  const persona: PersonaId = isPersonaId(pParam) ? pParam : initial;
  const [view, setView] = useState<ViewId>('home');

  const Screen = view === 'library' ? PersonaLibrary : view === 'plan' ? PersonaPlan : PersonaHome;

  function selectPersona(id: PersonaId) {
    const params = new URLSearchParams(sp.toString());
    params.set('p', id);
    router.replace(`/my/personas?${params.toString()}`, { scroll: false });
  }

  const pill = (active: boolean) => ({
    padding: '5px 12px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--semo-primary)' : 'var(--semo-line)'}`,
    background: active ? 'var(--semo-primary)' : 'var(--semo-surface)',
    color: active ? '#fff' : 'var(--semo-fg-2)',
  });

  return (
    <>
      <Screen persona={persona} />

      <div
        style={{
          position: 'fixed',
          left: 18,
          bottom: 18,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 10,
          borderRadius: 'var(--r-14)',
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          boxShadow: 'var(--semo-shadow-2)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {PERSONA_META.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPersona(p.id)}
              style={pill(persona === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              style={pill(view === v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
