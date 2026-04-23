'use client';

import Link from 'next/link';
import type { PersonLinkProps } from '@team-semicolon/dashboard-ui';

export default function NextPersonLink({ href, onClick, className, children }: PersonLinkProps) {
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
