/**
 * @file app/page.tsx
 * @description 루트 경로(`/`) 핸들러. `/dashboard`로 리다이렉트한다.
 * @route /
 * @renderMode SSR (서버 컴포넌트)
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
