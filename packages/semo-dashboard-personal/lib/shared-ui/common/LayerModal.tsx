'use client';

import type { ReactNode } from 'react';

interface LayerModalProps {
  open: boolean;
  onClose: () => void;
  icon?: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export default function LayerModal({
  open,
  onClose,
  icon,
  title,
  subtitle,
  showBack,
  onBack,
  headerActions,
  children,
  maxWidth = 'max-w-2xl',
}: LayerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${maxWidth} max-h-[85vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {showBack && (
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mr-1"
              >
                &larr;
              </button>
            )}
            {icon && <span className="text-2xl shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none ml-2"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
