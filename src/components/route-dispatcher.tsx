'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { ObjectExplorer } from './object-explorer';
import { UserProfileViewer } from './user-profile-viewer';

function InnerDispatcher() {
  const pathname = usePathname();
  const norm = pathname.replace(/\/+$/, '') || '/';

  // Match /object/<objectId>
  const objMatch = norm.match(/^\/object\/([^/]+)/);
  if (objMatch?.[1]) {
    return <ObjectExplorer initialObjectId={decodeURIComponent(objMatch[1])} />;
  }

  // Match /@<username>/<permlink>
  const postMatch = norm.match(/^\/@([^/]+)\/([^/]+)/);
  if (postMatch?.[1] && postMatch?.[2]) {
    return (
      <UserProfileViewer
        username={decodeURIComponent(postMatch[1])}
        permlink={decodeURIComponent(postMatch[2])}
      />
    );
  }

  // Match /@<username>
  const userMatch = norm.match(/^\/@([^/]+)$/);
  if (userMatch?.[1]) {
    return <UserProfileViewer username={decodeURIComponent(userMatch[1])} />;
  }

  // Default to Home / ObjectExplorer (reads ?id= or defaults to 6nltas-recipes)
  return <ObjectExplorer />;
}

export function RouteDispatcher() {
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
      <InnerDispatcher />
    </Suspense>
  );
}
