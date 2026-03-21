'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
import { useLang } from '@/lib/i18n';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const labels = {
  ko: { title: '개발자에게 피드백', placeholder: '의견이나 제안을 자유롭게 작성해주세요...', send: '보내기', thanks: '피드백 감사합니다! 🙏', cancel: '취소' },
  en: { title: 'Feedback to Developer', placeholder: 'Share your thoughts or suggestions...', send: 'Send', thanks: 'Thanks for your feedback! 🙏', cancel: 'Cancel' },
  ja: { title: '開発者へのフィードバック', placeholder: 'ご意見やご提案をお聞かせください...', send: '送信', thanks: 'フィードバックありがとうございます！🙏', cancel: 'キャンセル' },
};

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { lang } = useLang();
  const l = labels[lang];

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);
    await supabase.from('feedback').insert({
      message: message.trim(),
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    });
    setSending(false);
    setSent(true);
    setMessage('');
    setTimeout(() => { setSent(false); setOpen(false); }, 1500);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-2 px-2 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 hover:border-gray-400 rounded-full transition-colors hover:bg-gray-50"
      >
        {lang === 'ko' ? '피드백' : lang === 'ja' ? 'FB' : 'Feedback'}
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[90%] max-w-md mx-4 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">💬 {l.title}</h3>
            {sent ? (
              <p className="text-center py-8 text-gray-600">{l.thanks}</p>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={l.placeholder}
                  rows={4}
                  className="w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    {l.cancel}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || sending}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '...' : l.send}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
