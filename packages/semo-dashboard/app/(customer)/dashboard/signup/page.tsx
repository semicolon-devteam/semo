'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * 고객 가입/로그인 (T67). 같은 Supabase auth 풀을 쓰고, 세션이 생기면 /dashboard/start 로.
 * 가게(테넌트) 생성은 거기서 — 신규는 모드 선택(PersonaSelect)이 가게를 만들고, 기존
 * 사용자는 곧장 /dashboard 로 통과한다. 게이팅 여부와 무관하게 이 페이지는 항상 공개.
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
      // 세션이 바로 생기면(이메일 확인 off) 온보딩 게이트로. 가게 생성/모드 선택은 거기서.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        window.location.href = '/dashboard/start';
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

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/start`,
        },
      });
      if (error) {
        setMsg(error.message);
        setBusy(false);
      }
      // 성공 시 브라우저가 Google OAuth 로 리다이렉트 — 여기서 추가 작업 없음.
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

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '11px 14px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--semo-fg-1)',
            background: '#fff',
            border: '1px solid var(--semo-line-strong)',
            borderRadius: 'var(--r-10)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.7 : 1,
          }}
          aria-label="Google 계정으로 계속하기"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A8.997 8.997 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.92A8.997 8.997 0 0 0 0 9c0 1.45.35 2.82.92 4.05l3.05-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .92 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          Google로 계속하기
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            color: 'var(--semo-fg-3)',
          }}
          aria-hidden
        >
          <span style={{ flex: 1, height: 1, background: 'var(--semo-line)' }} />
          <span>또는</span>
          <span style={{ flex: 1, height: 1, background: 'var(--semo-line)' }} />
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
