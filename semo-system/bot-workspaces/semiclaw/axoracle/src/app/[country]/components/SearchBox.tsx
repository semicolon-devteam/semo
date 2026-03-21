'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { t, getOccupationName } from '@/lib/translations';

interface Occupation {
  id: string;
  name_en: string;
  name_local: string;
  average_salary: number;
  currency: string;
}

interface SearchBoxProps {
  occupations: Occupation[];
  country: string;
}

function formatSalary(amount: number, currency: string): string {
  if (currency === 'KRW') return `₩${(amount / 10000).toLocaleString()}만원`;
  if (currency === 'JPY') return `¥${(amount / 10000).toLocaleString()}万円`;
  return `$${amount.toLocaleString()}`;
}

export default function SearchBox({ occupations, country }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { lang } = useLang();
  const tr = t[lang];

  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return occupations
      .filter((occ) => {
        const displayName = getOccupationName(occ, lang);
        return (
          displayName.toLowerCase().includes(lowerQuery) ||
          occ.name_en.toLowerCase().includes(lowerQuery) ||
          occ.name_local.toLowerCase().includes(lowerQuery)
        );
      })
      .slice(0, 10);
  }, [query, occupations, lang]);

  function handleClick(occupation: Occupation) {
    setLoadingId(occupation.id);
    startTransition(() => {
      router.push(`/${country}/${occupation.id}`);
    });
  }

  return (
    <div className="relative mb-8">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={tr.searchPlaceholder}
          className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
        />
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {showResults && query.trim() && (
        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-96 overflow-y-auto">
          {filteredResults.length > 0 ? (
            <div className="divide-y">
              {filteredResults.map((occupation) => {
                const isLoading = isPending && loadingId === occupation.id;
                return (
                  <button
                    key={occupation.id}
                    onClick={() => handleClick(occupation)}
                    disabled={isPending}
                    className="block w-full text-left p-4 hover:bg-blue-50 transition-colors disabled:opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{getOccupationName(occupation, lang)}</p>
                        <p className="text-sm text-gray-500">{occupation.name_en}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        {isLoading && (
                          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        <p className="font-bold text-blue-600">
                          {formatSalary(occupation.average_salary, occupation.currency)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>{tr.noResults}</p>
              <p className="text-sm mt-2">{tr.tryOther}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
