'use client';

export function SandboxBadge() {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700">
      SANDBOX
    </span>
  );
}

export function isSandboxProject(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  const sandbox = metadata.sandbox as Record<string, unknown> | undefined;
  return sandbox?.enabled === true;
}
