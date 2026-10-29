'use client';

import { Suspense } from 'react';

import { ObjectExplorer } from '@/components/object-explorer';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square animate-pulse rounded-card border border-border bg-secondary"
            />
          ))}
        </div>
      }
    >
      <ObjectExplorer />
    </Suspense>
  );
}
