'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 고객 가입/로그인 (T67). 같은 Supabase auth 풀을 쓰고, 가입 직후
 * /api/my/tenant/ensure 로 내 가게(테넌트)를 생성한 뒤 /my 로 이동.
 * 게이팅(SEMO_CUSTOMER_GATING) 여부와 무관하게 이 페이지는 항상 공개.
 */
export default function SignupPage() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      const { error } =
        mode === 'signup'
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        setBusy(false);
        return;
      }
      // 세션이 바로 생기면(이메일 확인 off) 테넌트 생성 후 진입.
      const res = await fetch('/api/my/tenant/ensure', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/my';
        return;
      }
      // 이메일 확인이 필요한 경우 등 — 세션 아직 없음.
      setMsg('확인 메일을 보냈어요. 메일의 링크로 인증한 뒤 로그인해 주세요.');
      setBusy(false);
    } catch {
      setMsg('잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--semo-bg-soft)',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 360,
          background: 'var(--semo-surface)',
          border: '1px solid var(--semo-line)',
          borderRadius: 'var(--r-16)',
          boxShadow: 'var(--semo-shadow-2)',
          padding: 28,
          display: 'grid',
          gap: 14,
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--semo-fg-1)',
              letterSpacing: '-0.02em',
            }}
          >
            {mode === 'signup' ? '내 가게 시작하기' : '다시 오셨네요'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--semo-fg-3)' }}>
            {mode === 'signup'
              ? 'AI 직원을 채용하고 가게를 운영해보세요.'
              : '로그인해서 내 직원들을 만나보세요.'}
          </div>
        </div>

        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {msg && (
          <div style={{ fontSize: 12.5, color: 'var(--semo-fg-2)', lineHeight: 1.5 }}>{msg}</div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '12px 14px',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            background: 'var(--semo-primary)',
            border: 'none',
            borderRadius: 'var(--r-10)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? '처리 중…' : mode === 'signup' ? '가입하고 시작하기' : '로그인'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'login' : 'signup'));
            setMsg(null);
          }}
          style={{
            fontSize: 13,
            color: 'var(--semo-primary)',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {mode === 'signup' ? '이미 계정이 있어요 → 로그인' : '처음이신가요? → 가입하기'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  fontSize: 14,
  background: 'var(--semo-bg-soft)',
  border: '1px solid var(--semo-line-strong)',
  borderRadius: 'var(--r-10)',
  outline: 'none',
  color: 'var(--semo-fg-1)',
};
