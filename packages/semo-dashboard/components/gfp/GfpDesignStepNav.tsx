'use client';

import { DESIGN_STEPS, type DesignStep } from '@/types';

interface GfpDesignStepNavProps {
  currentStep: DesignStep;
  stepStatuses: Record<number, 'pending' | 'in-progress' | 'completed'>;
  onStepClick: (step: DesignStep) => void;
}

const STEP_ICONS: Record<string, string> = {
  'magnifying-glass': '\uD83D\uDD0D',
  palette: '\uD83C\uDFA8',
  code: '\uD83D\uDCBB',
  eye: '\uD83D\uDC41',
  'arrow-right': '\u2192',
};

export default function GfpDesignStepNav({ currentStep, stepStatuses, onStepClick }: GfpDesignStepNavProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {DESIGN_STEPS.map((def, idx) => {
        const status = stepStatuses[def.step] ?? 'pending';
        const isActive = def.step === currentStep;
        const isPast = status === 'completed';

        return (
          <div key={def.step} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-6 h-px mx-1 ${
                  isPast ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            )}
            <button
              onClick={() => onStepClick(def.step as DesignStep)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ring-1 ring-purple-400'
                  : isPast
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="text-sm">{STEP_ICONS[def.icon] ?? ''}</span>
              <span>{def.label}</span>
              {isPast && <span className="text-green-500">&#x2713;</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
