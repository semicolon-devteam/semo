'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { useLang } from '@/lib/i18n';

const shareTexts = {
  ko: {
    title: (name: string, score: string, level: string) => `나의 직업 AI 대체 위험도: ${score}% (${level})`,
    text: (name: string, score: string) => `${name}의 AI 대체 위험도는 ${score}%! 너의 직업은? 🤖`,
    fallback: 'AI 직업 위험도 분석 결과를 확인해보세요!',
    copied: '링크 복사됨!',
    share: '결과 공유하기',
  },
  en: {
    title: (name: string, score: string, level: string) => `AI Replacement Risk: ${score}% (${level})`,
    text: (name: string, score: string) => `${name}'s AI replacement risk is ${score}%! What about yours? 🤖`,
    fallback: 'Check out this AI job replacement risk analysis!',
    copied: 'Link copied!',
    share: 'Share results',
  },
  ja: {
    title: (name: string, score: string, level: string) => `AI代替リスク: ${score}% (${level})`,
    text: (name: string, score: string) => `${name}のAI代替リスクは${score}%！あなたの職業は？🤖`,
    fallback: 'AI職業代替リスク分析結果をチェック！',
    copied: 'リンクコピー済み！',
    share: '結果を共有',
  },
};

interface ShareButtonProps {
  occupationName?: string;
  occupationNameEn?: string;
  occupationId?: string;
  riskScore?: number;
  riskLevel?: string;
  country?: string;
}

export default function ShareButton({
  occupationName,
  occupationNameEn,
  occupationId,
  riskScore,
  riskLevel,
  country,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { lang } = useLang();
  const txt = shareTexts[lang];

  const handleShare = async () => {
    trackEvent({
      event_type: 'share_click',
      country,
      occupation_id: occupationId,
      occupation_name: occupationName,
      risk_score: riskScore,
    });

    const score = riskScore?.toFixed(1) ?? '0';
    const title = riskScore != null
      ? txt.title(occupationName || '', score, riskLevel || '')
      : document.title;
    const text = occupationName
      ? txt.text(occupationName, score)
      : txt.fallback;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: window.location.href });
        trackEvent({
          event_type: 'share_complete',
          country,
          occupation_id: occupationId,
          occupation_name: occupationName,
          risk_score: riskScore,
          shared_via: 'web_share',
        });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }

    trackEvent({
      event_type: 'share_complete',
      country,
      occupation_id: occupationId,
      occupation_name: occupationName,
      risk_score: riskScore,
      shared_via: 'clipboard',
    });

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
      title={copied ? txt.copied : txt.share}
    >
      {copied ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}
