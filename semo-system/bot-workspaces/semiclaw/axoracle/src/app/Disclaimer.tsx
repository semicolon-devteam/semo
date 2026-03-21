'use client';

import { useLang } from '@/lib/i18n';

const disclaimers: Record<string, string> = {
  ko: '⚠️ 본 서비스는 재미 및 참고용입니다. AI 대체 위험도와 연봉은 공개 자료 기반 추정치이며, 실제 고용 시장을 정확히 반영하지 않습니다. 이 서비스는 절대 당신의 인생을 책임져주지 않습니다. 🙏',
  en: '⚠️ This service is for fun & reference only. AI risk scores and salary data are estimates based on public sources and do not accurately reflect the real job market. This service will absolutely not take responsibility for your life decisions. 🙏',
  ja: '⚠️ 本サービスは娯楽・参考目的のみです。AI代替リスクと年収は公開データに基づく推定値であり、実際の雇用市場を正確に反映していません。本サービスはあなたの人生に一切責任を負いません。🙏',
};

export default function Disclaimer() {
  const { lang } = useLang();

  return (
    <div className="max-w-2xl w-full px-4 mb-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
        <p className="text-xs text-amber-700 leading-relaxed">{disclaimers[lang]}</p>
      </div>
    </div>
  );
}
