'use client';

import { useEffect, useRef, useState } from 'react';

function ensureLR(code: string): string {
  return code.replace(/^(graph|flowchart)\s+(TD|TB)\b/m, '$1 LR');
}

export default function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
      mermaid
        .render(id, ensureLR(code))
        .then(({ svg }) => {
          if (!cancelled && ref.current) {
            ref.current.innerHTML = svg;
          }
        })
        .catch((err) => {
          if (!cancelled) setError(String(err));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-xs text-red-600 dark:text-red-400 mb-1">Mermaid rendering error</p>
        <pre className="text-xs text-red-500 overflow-x-auto">{code}</pre>
      </div>
    );
  }

  return <div ref={ref} className="my-4 flex justify-center" />;
}
