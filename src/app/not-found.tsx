'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { ObjectExplorer } from '@/components/object-explorer';
import { useI18n } from '@/i18n';

function NotFoundRouter() {
  const { t } = useI18n();
  const pathname = usePathname();
  const objMatch = pathname.match(/^\/object\/([^/]+)/);
  const legacyObjectId = objMatch?.[1] ? decodeURIComponent(objMatch[1]) : null;

  if (legacyObjectId) {
    return <ObjectExplorer initialObjectId={legacyObjectId} />;
  }

  return (
    <div className="rounded-card border border-border bg-surface p-8 text-center">
      <h1 className="text-display text-fg">404</h1>
      <p className="mt-2 text-body text-fg-secondary">{t('explore.noResults')}</p>
      <Link
        href="/?id=6nltas-recipes"
        className="mt-4 inline-block rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg"
      >
        {t('nav.byCountry')}
      </Link>
    </div>
  );
}

export default function NotFoundPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-secondary" />}>
      <NotFoundRouter />
    </Suspense>
  );
}
