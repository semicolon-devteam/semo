'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function OccupationLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      onClick={() => startTransition(() => router.push(href))}
      className={`block p-4 cursor-pointer transition-colors ${isPending ? 'bg-blue-50' : 'hover:bg-gray-50 active:bg-gray-100'}`}
    >
      {children}
      {isPending && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-500">Loading...</span>
        </div>
      )}
    </div>
  );
}
