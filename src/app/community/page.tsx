'use client';

import { Suspense } from 'react';

import { ObjectExplorer } from '@/components/object-explorer';

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-secondary" />}>
      <ObjectExplorer initialObjectId="eai-hive-cooking-community" />
    </Suspense>
  );
}
