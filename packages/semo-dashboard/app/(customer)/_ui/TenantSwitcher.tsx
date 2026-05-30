'use client';

import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

/**
 * 어드민/dev 매직키 뷰어 전용 테넌트 스위처 — 고객 셸 Topbar 에 노출.
 *
 * 쿠키 'semo-admin-tenant=<slug>' 설정 → 서버측 requireOwnedTenantSlug 가
 * 그 테넌트의 데이터를 로드. RLS 없으므로 클라/서버 양쪽에서 어드민 가드 필수
 * (서버: isTeamOrDevViewer, 클라: useAuth().isAdmin).
 *
 * dev 매직키 뷰어는 /api/auth/me 가 DEV_PROFILE(role=admin) 반환 → isAdmin true.
 */
const COOKIE_NAME = 'semo-admin-tenant';

interface TenantSummary {
  slug: string;
  displayName: string;
  tenantType: string;
  planSlug: string;
  owned: boolean;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * 쿠키를 외부 상태로 읽는다(useSyncExternalStore). useEffect+setState 동기화는
 * react-hooks/set-state-in-effect 위반이고 SSR-hydration 도 깨끗하지 않다.
 * 쿠키는 자체 알림 메커니즘이 없으므로 subscribe 는 no-op — onSelect 가 쿠키 쓰고
 * router.refresh() 호출하면 자연스럽게 재렌더되며 새 값 읽힌다.
 */
const noopSub = () => () => {};
const getServerCookie = (): string | null => null;
function writeCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return;
  if (value === null) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax`;
  }
}

export default function TenantSwitcher() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // 어드민만(또는 dev 매직키 — DEV_PROFILE role=admin). 로딩 중에는 숨김.
  const visible = !loading && isAdmin;

  // 현재 선택된 테넌트 쿠키 — 외부 상태(쿠키)는 useSyncExternalStore 로 읽는다.
  const current = useSyncExternalStore(noopSub, () => readCookie(COOKIE_NAME), getServerCookie);

  // 테넌트 목록 (admin 시에만 fetch)
  useEffect(() => {
    if (!visible || loaded) return;
    fetch('/api/admin/tenants')
      .then((r) => (r.ok ? r.json() : { tenants: [] }))
      .then((d: { tenants?: TenantSummary[] }) => {
        setTenants(d.tenants ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [visible, loaded]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!visible || tenants.length <= 1) return null;

  const onSelect = (slug: string | null) => {
    writeCookie(COOKIE_NAME, slug);
    setOpen(false);
    // 서버 컴포넌트 재실행으로 새 쿠키 반영(useSyncExternalStore 가 재읽어 current 갱신).
    router.refresh();
  };

  const currentTenant = tenants.find((t) => t.slug === current);
  const label = currentTenant ? currentTenant.displayName : '기본';

  const triggerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'var(--semo-surface)',
    border: '1px solid var(--semo-line)',
    borderRadius: 'var(--r-10)',
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--semo-fg-1)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
  const dotStyle: React.CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--semo-ai)',
    flexShrink: 0,
  };
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 6,
    minWidth: 240,
    maxHeight: 360,
    overflowY: 'auto',
    background: 'var(--semo-surface)',
    border: '1px solid var(--semo-line)',
    borderRadius: 'var(--r-12)',
    boxShadow: 'var(--semo-shadow-2, 0 12px 24px rgba(0,0,0,0.12))',
    padding: 6,
    zIndex: 20,
  };
  const itemStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    background: selected ? 'var(--semo-ai-08)' : 'transparent',
    border: 'none',
    borderRadius: 'var(--r-8)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--semo-fg-1)',
    cursor: 'pointer',
  });

  return (
    <div ref={ref} style={{ position: 'relative' }} aria-label="테넌트 스위처 (어드민)">
      <button type="button" onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        <span style={dotStyle} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <span style={{ color: 'var(--semo-fg-3)', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div role="menu" style={menuStyle}>
          <button
            type="button"
            role="menuitem"
            onClick={() => onSelect(null)}
            style={itemStyle(current === null)}
          >
            <span style={{ ...dotStyle, background: 'var(--semo-fg-muted)' }} />
            <span style={{ flex: 1 }}>
              <div>기본 (소유/데모)</div>
              <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 400 }}>
                requireOwnedTenantSlug 폴백
              </div>
            </span>
          </button>
          <div style={{ height: 1, background: 'var(--semo-line-soft)', margin: '4px 2px' }} />
          {tenants.map((t) => (
            <button
              key={t.slug}
              type="button"
              role="menuitem"
              onClick={() => onSelect(t.slug)}
              style={itemStyle(current === t.slug)}
            >
              <span
                style={{
                  ...dotStyle,
                  background: t.owned ? 'var(--semo-success)' : 'var(--semo-ai)',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--semo-fg-3)', fontWeight: 400 }}>
                  {t.slug} · {t.tenantType} · {t.planSlug}
                  {t.owned ? ' · owned' : ''}
                </div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
