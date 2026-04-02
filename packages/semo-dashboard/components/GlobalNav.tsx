'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/bots', label: '봇 팀' },
  { href: '/org', label: '조직도' },
  { href: '/cost', label: '비용' },
  { href: '/goals', label: '목표' },
  { href: '/action-items', label: '액션' },
  { href: '/kb', label: '지식' },
  { href: '/system', label: '시스템' },
  { href: '/tests', label: '테스트' },
  { href: '/gfp', label: 'GFP' },
  { href: '/meetings', label: '회의' },
];

export default function GlobalNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close on outside click
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

  // Prevent body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === '/kb') return pathname === '/kb' || pathname === '/ontology';
    if (href === '/system') return pathname === '/db' || pathname === '/sync' || pathname === '/system';
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

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <Image src="/logo.png" alt="SEMO" width={28} height={28} />
              SEMO
            </Link>
            {/* Desktop menu */}
            <div className="hidden md:flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Hamburger button (mobile) */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu items */}
            <div className="px-3 py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className={mobileLinkClass(item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
