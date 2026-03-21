'use client';

import { useState, useRef, useEffect } from 'react';

export default function SectionTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  return (
    <div className="relative inline-block ml-1.5" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold inline-flex items-center justify-center hover:bg-gray-300 transition-colors"
        aria-label="Info"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-7 w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg leading-relaxed">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-800 rotate-45" />
          <span className="relative z-10">{text}</span>
        </div>
      )}
    </div>
  );
}
