'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'ko' | 'en' | 'ja';

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'ko',
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ko');

  useEffect(() => {
    const saved = localStorage.getItem('axoracle-lang') as Lang;
    if (saved && ['ko', 'en', 'ja'].includes(saved)) setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('axoracle-lang', l);
  }

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
