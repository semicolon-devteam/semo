'use client';

import { useLang } from '@/lib/i18n';
import { getExpLevelName } from '@/lib/translations';

interface ExperienceLevel {
  id: string;
  name_ko: string;
  name_en: string;
  name_ja: string;
  year_min: number;
  year_max: number | null;
}

interface ExperienceSelectorProps {
  levels: ExperienceLevel[];
  current: string;
  onSelect: (levelId: string) => void;
}

export default function ExperienceSelector({ levels, current, onSelect }: ExperienceSelectorProps) {
  const { lang } = useLang();

  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((level) => {
        const isActive = current === level.id;
        const yearLabel = level.year_max
          ? `${level.year_min}-${level.year_max}${lang === 'ja' ? '年' : lang === 'ko' ? '년' : 'y'}`
          : `${level.year_min}${lang === 'ja' ? '年+' : lang === 'ko' ? '년+' : 'y+'}`;
        return (
          <button
            key={level.id}
            onClick={() => onSelect(level.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {getExpLevelName(level, lang)}
            <span className={`ml-1 text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
              {yearLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
