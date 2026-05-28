'use client';

import { useState } from 'react';
import { PersonaHome, PersonaLibrary, PersonaPlan } from './screen-persona';
import { listPersonaMeta } from '@/lib/customer/persona/registry';
import type { PersonaId } from '@/lib/customer/persona/schema';

/**
 * Persona 미리보기 스위처 (클라이언트). 초기 persona 는 서버에서 resolve 되어 주입된다
 * (URL ?p= → 설정 → fallback). 라벨은 registry(JSON 정본) 에서 가져온다.
 */
const PERSONA_META = listPersonaMeta();
const VIEWS = [
  { id: 'home', label: '홈' },
  { id: 'library', label: '채용' },
  { id: 'plan', label: '요금제' },
] as const;
type ViewId = (typeof VIEWS)[number]['id'];

export default function PersonaSwitcher({ initial }: { initial: PersonaId }) {
  const [persona, setPersona] = useState<PersonaId>(initial);
  const [view, setView] = useState<ViewId>('home');

  const Screen = view === 'library' ? PersonaLibrary : view === 'plan' ? PersonaPlan : PersonaHome;

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
              onClick={() => setPersona(p.id)}
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
