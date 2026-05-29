'use client';

import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

/**
 * InternalShell — 운영팀(내부) 대시보드 셸 (SEMO v5).
 *
 * 고객 대시보드와 동일한 사이드바+탑바 디자인 시스템을 내부 라우트에 적용(dogfooding).
 * 기존 상단 GlobalNav 를 대체. 데이터/로직은 각 페이지가 그대로 처리 — 셸은 chrome 만.
 * cull 페이지(/tests,/db,/sync,/voice,/system,/ontology)는 네비에서 제외.
 */

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6" />
      <path d="M21 19a5 5 0 0 0-4-4.9" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="18" r="2" />
      <path d="M12 7v3M6.7 16.5l3-3M17.3 16.5l-3-3" />
    </>
  ),
  check: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </>
  ),
  rocket: (
    <>
      <path d="M14 4c4 0 6 2 6 6-2 0-4 1-6 3l-3-3c2-2 3-4 3-6Z" />
      <path d="m11 13-4 4 1 4 4-1 4-4" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 8v8M8 12h8M6 8c0 2 1 4 3 4" />
    </>
  ),
  zap: <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />,
  book: (
    <>
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4Z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 15h3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h12" />,
  store: (
    <>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9v10h16V9" />
      <path d="M9 19v-6h6v6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
};

function Icon({
  name,
  size = 17,
  color = 'currentColor',
  stroke = 1.7,
}: {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
}) {
  const body = ICONS[name];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {body}
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
const NAV_PRIMARY: NavItem[] = [
  { href: '/team', label: '홈', icon: 'home' },
  { href: '/bots', label: '봇 팀', icon: 'users' },
  { href: '/kb', label: '지식', icon: 'network' },
  { href: '/action-items', label: '액션', icon: 'check' },
  { href: '/goals', label: '목표', icon: 'target' },
  { href: '/meetings', label: '회의', icon: 'calendar' },
  { href: '/projects', label: '서비스', icon: 'rocket' },
  { href: '/org', label: '조직도', icon: 'git' },
  { href: '/orchestrator-flow', label: '위임 현황', icon: 'zap' },
];
const NAV_SECONDARY: NavItem[] = [
  { href: '/board', label: '자료실', icon: 'book' },
  { href: '/cost', label: '비용', icon: 'card' },
  { href: '/agents', label: '에이전트', icon: 'grid' },
  { href: '/tasks', label: '런', icon: 'list' },
];

function NavLink({ item, active, onNav }: { item: NavItem; active: boolean; onNav?: () => void }) {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 'var(--r-10)',
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
    background: active ? 'var(--semo-surface)' : 'transparent',
    border: `1px solid ${active ? 'var(--semo-line)' : 'transparent'}`,
    color: active ? 'var(--semo-fg-1)' : 'var(--semo-fg-2)',
    boxShadow: active ? 'var(--semo-shadow-1)' : 'none',
  };
  return (
    <Link href={item.href} onClick={onNav} style={base}>
      <Icon
        name={item.icon}
        size={17}
        color={active ? 'var(--semo-primary)' : 'var(--semo-fg-3)'}
      />
      <span style={{ flex: 1 }}>{item.label}</span>
    </Link>
  );
}

function SidebarBody({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  const isActive = (href: string) =>
    href === '/kb'
      ? pathname === '/kb' || pathname === '/ontology'
      : pathname === href || pathname.startsWith(href + '/');
  return (
    <>
      {/* brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 14px' }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--semo-fg-1)',
            color: 'var(--semo-primary)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          }}
        >
          ;
        </span>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--semo-fg-1)',
              letterSpacing: '-0.02em',
            }}
          >
            SEMO
          </div>
          <div style={{ fontSize: 11, color: 'var(--semo-fg-3)' }}>세미콜론 팀 · 운영팀</div>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_PRIMARY.map((it) => (
          <NavLink key={it.href} item={it} active={isActive(it.href)} onNav={onNav} />
        ))}
        <div style={{ height: 1, background: 'var(--semo-line)', margin: '10px 6px' }} />
        {NAV_SECONDARY.map((it) => (
          <NavLink key={it.href} item={it} active={isActive(it.href)} onNav={onNav} />
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <Link
          href="/dashboard"
          onClick={onNav}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 'var(--r-10)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--semo-ai)',
            background: 'var(--semo-ai-08)',
            border: '1px solid var(--semo-ai-16)',
            textDecoration: 'none',
          }}
        >
          <Icon name="store" size={15} color="var(--semo-ai)" />
          고객 대시보드
        </Link>
      </div>
    </>
  );
}

export default function InternalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const { user, profile, isAdmin, loading, signOut } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  useEffect(() => {
    // 라우트 변경 시 드로어/메뉴 닫기.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawer(false);
    setUserMenu(false);
  }, [pathname]);

  const sidebarStyle: CSSProperties = {
    width: 232,
    flexShrink: 0,
    background: 'var(--semo-bg-soft)',
    borderRight: '1px solid var(--semo-line)',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
  };

  const avatarChar = (profile?.display_name || user?.email || '?')[0]?.toUpperCase() || '?';

  // 미인증/미승인은 셸 없이 children 만 — OnboardingGate 가 리다이렉트 처리.
  if (loading || !user) return <>{children}</>;
  if (profile && !isAdmin && profile.onboarding_status !== 'approved') return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--semo-bg)' }}>
      {/* desktop sidebar */}
      <aside className="hidden md:flex" style={sidebarStyle}>
        <SidebarBody pathname={pathname} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDrawer(false)}
          />
          <aside style={{ ...sidebarStyle, position: 'absolute', left: 0, top: 0, zIndex: 51 }}>
            <SidebarBody pathname={pathname} onNav={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* topbar */}
        <header
          style={{
            height: 56,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 20px',
            background: 'color-mix(in srgb, var(--semo-bg) 88%, transparent)',
            backdropFilter: 'saturate(1.4) blur(8px)',
            WebkitBackdropFilter: 'saturate(1.4) blur(8px)',
            borderBottom: '1px solid var(--semo-line)',
          }}
        >
          <button
            className="md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="메뉴"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: 'var(--r-10)',
              background: 'var(--semo-surface)',
              border: '1px solid var(--semo-line)',
              cursor: 'pointer',
            }}
          >
            <Icon name="menu" size={18} color="var(--semo-fg-2)" />
          </button>

          <div
            className="hidden sm:flex"
            style={{
              alignItems: 'center',
              gap: 8,
              minWidth: 260,
              padding: '7px 10px',
              borderRadius: 'var(--r-10)',
              background: 'var(--semo-surface-2)',
              border: '1px solid var(--semo-line)',
              color: 'var(--semo-fg-3)',
              fontSize: 13,
            }}
          >
            <Icon name="search" size={15} color="var(--semo-fg-3)" />
            <span style={{ flex: 1 }}>지식·봇·활동 검색…</span>
          </div>

          <div style={{ flex: 1 }} />

          <button
            aria-label="알림"
            style={{
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
              width: 34,
              height: 34,
              borderRadius: 'var(--r-10)',
              background: 'var(--semo-surface)',
              border: '1px solid var(--semo-line)',
              cursor: 'pointer',
            }}
          >
            <Icon name="bell" size={17} color="var(--semo-fg-2)" />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenu((v) => !v)}
              aria-label="사용자 메뉴"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--agent-peach), var(--agent-coral))',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: '2px solid var(--semo-surface)',
                boxShadow: 'var(--semo-shadow-1)',
                cursor: 'pointer',
              }}
            >
              {avatarChar}
            </button>
            {userMenu && !loading && user && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 40,
                  width: 220,
                  background: 'var(--semo-surface)',
                  border: '1px solid var(--semo-line)',
                  borderRadius: 'var(--r-12)',
                  boxShadow: 'var(--semo-shadow-3)',
                  padding: 6,
                  zIndex: 60,
                }}
              >
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--semo-line)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--semo-fg-1)' }}>
                    {profile?.display_name || user.email}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--semo-fg-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.email}
                  </div>
                </div>
                {isAdmin && (
                  <>
                    <Link href="/admin/permissions" style={menuItemStyle}>
                      권한 설정
                    </Link>
                    <Link href="/admin/onboarding" style={menuItemStyle}>
                      가입 승인
                    </Link>
                  </>
                )}
                <button
                  onClick={signOut}
                  style={{
                    ...menuItemStyle,
                    color: 'var(--semo-danger)',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  display: 'block',
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--semo-fg-2)',
  textDecoration: 'none',
  borderRadius: 'var(--r-8)',
  border: 'none',
};
