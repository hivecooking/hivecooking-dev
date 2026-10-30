'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

import { ObjectExplorer } from './object-explorer';
import { UserProfileViewer } from './user-profile-viewer';

const RESERVED_PROFILE_FIRST_SEGMENTS = new Set([
  'threads',
  'messages',
  'comments',
  'mentions',
  'activity',
  'map',
  'user-shop',
  'recipe',
  'favorites',
  'transfers',
  'followers',
  'following',
  'following-objects',
  'reblogs',
  'expertise-hashtags',
  'expertise-objects',
  'about',
  'permissions',
]);

function InnerDispatcher() {
  const pathname = usePathname();
  const norm = pathname.replace(/\/+$/, '') || '/';

  // Match /object/<objectId>
  const objMatch = norm.match(/^\/object\/([^/]+)/);
  if (objMatch?.[1]) {
    return <ObjectExplorer initialObjectId={decodeURIComponent(objMatch[1])} />;
  }

  // Match /@<username>(/<rest>...)
  if (norm.startsWith('/@')) {
    const parts = norm.slice(2).split('/').filter(Boolean);
    const username = parts[0] ? decodeURIComponent(parts[0]) : '';
    if (username) {
      const rest = parts.slice(1).map((s) => decodeURIComponent(s));
      if (rest.length === 0) {
        return <UserProfileViewer username={username} subpath={[]} />;
      }
      if (rest[0] === 'post' && rest[1]) {
        return <UserProfileViewer username={username} permlink={rest[1]} />;
      }
      if (RESERVED_PROFILE_FIRST_SEGMENTS.has(rest[0])) {
        return <UserProfileViewer username={username} subpath={rest} />;
      }
      // Single non-reserved segment after @username -> standalone post view
      return <UserProfileViewer username={username} permlink={rest[0]} />;
    }
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
