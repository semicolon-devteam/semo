'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/provider';

/**
 * SEMO 홍보 랜딩 (공개).
 *
 * 2026-05-29 구조 개편:
 *   /          → 이 랜딩 (마케팅, 공개)
 *   /demo      → 더미 데이터 체험 대시보드 (공개)
 *   /dashboard → 실제 데이터 고객 대시보드 (로그인)
 *   /team      → 내부 운영팀 로드맵
 *
 * ⚠️ 이 파일은 Claude Design 산출물(index.html)로 교체될 자리(scaffold)다.
 *    교체 시: 마케팅 카피/비주얼은 디자인 산출물로, 단 상단 "내 대시보드" 버튼의
 *    useAuth 분기(고객→/dashboard, 팀→/team, 비로그인→/demo·/login)는 유지할 것.
 *    포지셔닝: "내 가게의 AI 직원 팀" (소상공인). 기술 용어·내부 7봇 노출 금지.
 */

const C = {
  bg: '#FAF9F4',
  bgSoft: '#F4F2EA',
  surface: '#FFFFFF',
  line: '#ECE9DF',
  fg1: '#1D242B',
  fg2: '#3B424B',
  fg3: '#6B7280',
  primary: '#068FFF',
  ai: '#7C5CFF',
};

const STAFF = [
  { name: '주문이', role: '주문·응대', color: '#FFB780', say: '새 주문 들어왔어요!' },
  { name: '회계도리', role: '회계', color: '#6FCFA3', say: '이번 달 순이익 정리했어요.' },
  { name: '알리미', role: '마케팅', color: '#B5A7FF', say: '오늘 인스타 문구 뽑아놨어요.' },
  { name: '채워', role: '재고', color: '#FF9685', say: '우유 곧 떨어져요, 주문할까요?' },
  { name: '셈이', role: '매출분석', color: '#8FC8FF', say: '화요일 매출이 20% 올랐어요.' },
  { name: '단골이', role: '고객관리', color: '#FFCB5E', say: '단골님께 쿠폰 보낼까요?' },
  { name: '비서', role: '일정', color: '#F49AC2', say: '내일 예약 2건 있어요.' },
];

function btn(filled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 22px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    border: filled ? 'none' : `1px solid ${C.line}`,
    background: filled ? C.primary : C.surface,
    color: filled ? '#fff' : C.fg2,
  };
}

export default function LandingPage() {
  const { user, profile, isCustomer, loading } = useAuth();
  // 로그인 사용자의 "내 대시보드" 목적지: 고객→/dashboard, 팀원→/team.
  const dashHref = isCustomer || !profile ? '/dashboard' : '/team';

  return (
    <main style={{ background: C.bg, color: C.fg1, minHeight: '100vh' }}>
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          maxWidth: 1120,
          margin: '0 auto',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 20 }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: C.fg1,
              color: C.primary,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
            }}
          >
            ;
          </span>
          SEMO
        </div>
        <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/demo" style={btn(false)}>
            체험하기
          </Link>
          {!loading && user ? (
            <Link href={dashHref} style={btn(true)}>
              내 대시보드
            </Link>
          ) : (
            <Link href="/login" style={btn(true)}>
              로그인
            </Link>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '64px 24px 48px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 999,
            background: '#fff',
            border: `1px solid ${C.line}`,
            color: C.ai,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          내 가게의 AI 직원 팀
        </div>
        <h1
          style={{
            fontSize: 44,
            lineHeight: 1.2,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
          }}
        >
          사장님 대신 일하는 AI 직원,
          <br />
          오늘부터 출근합니다
        </h1>
        <p
          style={{
            fontSize: 18,
            color: C.fg3,
            lineHeight: 1.6,
            margin: '20px auto 0',
            maxWidth: 560,
          }}
        >
          주문 응대·재고·회계·마케팅까지. 채용하듯 데려온 AI 직원이 가게 일을 대신 처리하고,
          일할수록 우리 가게를 기억합니다.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginTop: 32,
            flexWrap: 'wrap',
          }}
        >
          <Link href="/demo" style={{ ...btn(true), padding: '14px 28px', fontSize: 16 }}>
            무료로 체험하기
          </Link>
          <Link href="#staff" style={{ ...btn(false), padding: '14px 28px', fontSize: 16 }}>
            어떻게 일하나요?
          </Link>
        </div>
      </section>

      {/* AI staff cast */}
      <section id="staff" style={{ background: C.bgSoft, padding: '56px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <h2
            style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', letterSpacing: '-0.02em' }}
          >
            우리 가게에 필요한 직원을 데려오세요
          </h2>
          <p style={{ textAlign: 'center', color: C.fg3, marginTop: 8 }}>
            평소 말하듯 시키면, 알아서 처리하고 보고합니다.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
              marginTop: 32,
            }}
          >
            {STAFF.map((s) => (
              <div
                key={s.name}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.line}`,
                  borderRadius: 16,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: s.color,
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      color: '#fff',
                    }}
                  >
                    {s.name[0]}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12.5, color: C.fg3 }}>{s.role}</div>
                  </div>
                </div>
                <div
                  style={{
                    background: C.bgSoft,
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13.5,
                    color: C.fg2,
                  }}
                >
                  “{s.say}”
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why SEMO */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {[
            ['설정이 필요 없어요', '복잡한 세팅 없이, 말로 시키면 끝.'],
            ['우리 가게를 기억해요', '일할수록 단골·메뉴·운영 방식을 학습해요.'],
            ['직원들이 같이 일해요', '한 명에게 말하면 알아서 나눠서 처리해요.'],
            ['알바보다 저렴해요', '월 몇만 원으로 24시간 일하는 직원 팀.'],
          ].map(([t, d]) => (
            <div
              key={t}
              style={{
                background: C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 700 }}>{t}</div>
              <div style={{ fontSize: 14, color: C.fg3, marginTop: 8, lineHeight: 1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '24px 24px 72px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>
          오늘 첫 AI 직원을 만나보세요
        </h2>
        <div style={{ marginTop: 24 }}>
          <Link href="/demo" style={{ ...btn(true), padding: '14px 32px', fontSize: 16 }}>
            무료로 체험하기
          </Link>
        </div>
      </section>

      <footer
        style={{
          borderTop: `1px solid ${C.line}`,
          padding: '24px',
          textAlign: 'center',
          color: C.fg3,
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 8 }}>
          <Link href="/demo" style={{ color: C.fg3 }}>
            체험
          </Link>
          <Link href="/login" style={{ color: C.fg3 }}>
            로그인
          </Link>
        </div>
        © {new Date().getFullYear()} SEMO · 세미콜론
      </footer>
    </main>
  );
}
