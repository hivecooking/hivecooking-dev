'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_LOCALE,
  I18nProvider,
  loadMessages,
  persistLocale,
  resolveClientLocale,
  type LocaleId,
} from '@/i18n';
import { WalletProvider } from '@/modules/wallet';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<LocaleId>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_LOCALE;
    }
    return resolveClientLocale();
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar-SA' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = 'light';
  }, [locale]);

  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<LocaleId>).detail;
      if (next) {
        persistLocale(next);
        setLocale(next);
      }
    };
    window.addEventListener('hivecooking:set-locale', handler);
    return () => window.removeEventListener('hivecooking:set-locale', handler);
  }, []);

  const messages = useMemo(() => loadMessages(locale), [locale]);

  return (
    <I18nProvider locale={locale} messages={messages}>
      <WalletProvider>{children}</WalletProvider>
    </I18nProvider>
  );
}
