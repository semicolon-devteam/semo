'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface CountryCardProps {
  code: string;
  nameKo: string;
  nameEn: string;
  flag: string;
  description: string;
}

export default function CountryCard({ code, nameKo, nameEn, flag, description }: CountryCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      router.push(`/${code}`);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="group relative bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-500 hover:shadow-xl transition-all duration-300 cursor-pointer text-left w-full"
    >
      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-white/60 rounded-2xl flex items-center justify-center z-10">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Flag */}
      <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
        {flag}
      </div>

      {/* Country Name */}
      <h2 className="text-2xl font-bold mb-2 text-gray-800">{nameKo}</h2>
      <p className="text-sm text-gray-500 mb-4">{nameEn}</p>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>

      {/* Arrow Icon */}
      <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </button>
  );
}
