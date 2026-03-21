'use client';

import { useLang } from '@/lib/i18n';

const taglines: Record<string, string> = {
  ko: '이미 대체되어버린 개발자의 예언 혹은 다잉메시지 🥲',
  en: 'A prophecy — or dying message — from a developer already replaced 🥲',
  ja: 'すでに置き換えられた開発者の予言、あるいはダイイングメッセージ 🥲',
};

export default function HeroTagline() {
  const { lang } = useLang();
  return <p className="text-gray-500">{taglines[lang]}</p>;
}
