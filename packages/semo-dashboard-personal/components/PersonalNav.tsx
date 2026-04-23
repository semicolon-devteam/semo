import Link from 'next/link';

const LINKS = [
  { href: '/', label: '홈' },
  { href: '/bots', label: '봇' },
  { href: '/kb', label: 'KB' },
  { href: '/action-items', label: '액션 아이템' },
];

export default function PersonalNav() {
  return (
    <nav className="fixed top-0 inset-x-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 z-40">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
          SEMO Personal
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
