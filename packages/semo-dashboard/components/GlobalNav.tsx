'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';

const CORE_NAV = [
  { href: '/bots', label: '봇 팀', key: 'bots' },
  { href: '/org', label: '조직도', key: 'org' },
  { href: '/goals', label: '목표', key: 'goals' },
  { href: '/action-items', label: '액션', key: 'action-items' },
  { href: '/kb', label: '지식', key: 'kb' },
  { href: '/meetings', label: '회의', key: 'meetings' },
  { href: '/voice', label: '음성', key: 'voice' },
  { href: '/board', label: '자료실', key: 'board' },
];

const PLUGIN_NAV = [{ href: '/projects', label: '서비스', key: 'incubator' }];

const ADMIN_NAV = [
  { href: '/agents', label: '에이전트', key: 'agents' },
  { href: '/tasks', label: '런', key: 'tasks' },
  { href: '/orchestrator-flow', label: '오케스트레이션', key: 'orchestrator-flow' },
  { href: '/system', label: '시스템', key: 'system' },
  { href: '/cost', label: '비용', key: 'cost' },
  { href: '/tests', label: '테스트', key: 'tests' },
];

const NAV_ITEMS = [...CORE_NAV, ...PLUGIN_NAV, ...ADMIN_NAV];

export default function GlobalNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, menuAccess, isAdmin, loading, signOut } = useAuth();

  // Filter menu items based on access
  // admin이거나 프로필 미로드 시(fallback) 전체 메뉴 표시
  const visibleItems =
    isAdmin || !profile ? NAV_ITEMS : NAV_ITEMS.filter((item) => menuAccess.includes(item.key));

  // Close on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserMenuOpen(false);
  }, [pathname]);

  // Close on outside click (mobile menu)
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close on outside click (user menu)
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Prevent body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === '/kb') return pathname === '/kb' || pathname === '/ontology';
    if (href === '/system')
      return pathname === '/db' || pathname === '/sync' || pathname === '/system';
    return pathname === href || pathname.startsWith(href + '/');
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(href)
        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
    }`;

  const mobileLinkClass = (href: string) =>
    `block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
      isActive(href)
        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/30'
    }`;

  // 로딩 중이거나 미인증이면 nav 숨김
  if (loading || !user) return null;
  // 온보딩 미완료 사용자는 nav 숨김 (어드민 제외)
  if (profile && !isAdmin && profile.onboarding_status !== 'approved') return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white"
            >
              <Image src="/logo.png" alt="SEMO" width={28} height={28} />
              SEMO
            </Link>
            {/* Desktop menu */}
            <div className="hidden md:flex gap-1">
              {visibleItems.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 고객 대시보드(/my) 진입 — 운영팀↔고객 모드 전환 */}
            <Link
              href="/my"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              고객 대시보드
            </Link>

            {/* User avatar dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {profile?.display_name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  {isAdmin && (
                    <>
                      <Link
                        href="/admin/permissions"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        권한 설정
                      </Link>
                      <Link
                        href="/admin/onboarding"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        가입 승인
                      </Link>
                    </>
                  )}
                  <button
                    onClick={signOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger button (mobile) */}
            <button
              onClick={() => setMenuOpen(true)}
              className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay + slide panel */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Slide-in panel */}
          <div
            ref={panelRef}
            className="absolute top-0 right-0 w-72 h-full bg-white dark:bg-gray-800 shadow-xl animate-slide-in-right"
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200 dark:border-gray-700">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">메뉴</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Menu items */}
            <div className="px-3 py-4 space-y-1">
              {/* 고객 대시보드(/my) 진입 */}
              <Link
                href="/my"
                className="block px-4 py-3 mb-1 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                고객 대시보드
              </Link>
              {visibleItems.map((item) => (
                <Link key={item.href} href={item.href} className={mobileLinkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Mobile user section */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
              <div className="flex items-center gap-3 mb-3">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {profile?.display_name || user.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full text-center px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
