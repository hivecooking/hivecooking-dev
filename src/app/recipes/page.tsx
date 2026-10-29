'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';

import { useI18n } from '@/i18n';
import {
  fetchDiscoverObjects,
  getObjectAvatarUrl,
  getObjectDisplayName,
  type DiscoverObjectsResponse,
} from '@/modules/query-api';
import { useInfiniteScroll } from '@/shared';
import { isOk } from '@/shared/domain/result';

const FALLBACK_RECIPE_IMG =
  'https://waivio.nyc3.digitaloceanspaces.com/ab36044f80dd2351b19f3557fc4c2caa1a0e07965c620e648043adbdb4886180';

function AllRecipesCatalog() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<'rank' | 'newest'>('rank');
  const [items, setItems] = useState<DiscoverObjectsResponse['items']>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = useCallback(
    async (nextCursor: string | null, replace: boolean, searchQ: string, sortBy: 'rank' | 'newest') => {
      setLoading(true);
      setError(null);
      const res = await fetchDiscoverObjects({
        object_type: 'recipe',
        q: searchQ.trim() || undefined,
        sort: sortBy,
        cursor: nextCursor ?? undefined,
        limit: 20,
      });
      setLoading(false);
      if (!isOk(res)) {
        setError(t('explore.error'));
        return;
      }
      setItems((prev) => (replace ? res.value.items : [...prev, ...res.value.items]));
      setCursor(res.value.cursor);
      setHasMore(res.value.hasMore);
    },
    [t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(initialQuery);
      void loadRecipes(null, true, initialQuery, sort);
    }, 0);
    return () => clearTimeout(timer);
  }, [initialQuery, sort, loadRecipes]);

  const handleFilterSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void loadRecipes(null, true, query, sort);
    },
    [loadRecipes, query, sort],
  );

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoading: loading,
    onLoadMore: () => {
      if (cursor) {
        void loadRecipes(cursor, false, query, sort);
      }
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-display text-fg">{t('nav.allRecipes')}</h1>
          <p className="text-body-sm text-fg-secondary">{t('recipes.catalogSubtitle')}</p>
        </div>

        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('recipes.filterPlaceholder')}
            className="rounded-btn border border-border bg-surface px-3 py-2 text-body-sm text-fg"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'rank' | 'newest')}
            className="rounded-btn border border-border bg-surface px-3 py-2 text-body-sm text-fg"
          >
            <option value="rank">{t('recipes.sortRank')}</option>
            <option value="newest">{t('recipes.sortNewest')}</option>
          </select>
          <button
            type="submit"
            className="rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg"
          >
            {t('explore.search')}
          </button>
        </form>
      </div>

      {error ? (
        <p className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => {
          const name = getObjectDisplayName(item);
          const img = getObjectAvatarUrl(item) ?? FALLBACK_RECIPE_IMG;
          return (
            <Link
              key={item.object_id}
              href={`/object/${encodeURIComponent(item.object_id)}`}
              className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-control">
                <img
                  src={img}
                  alt={name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex min-h-[42px] items-center justify-center bg-accent px-2.5 py-2 text-center text-body-sm font-semibold text-accent-fg">
                <span className="line-clamp-2 leading-snug">{name}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square animate-pulse rounded-card border border-border bg-secondary"
            />
          ))}
        </div>
      ) : null}

      <div ref={sentinelRef} aria-hidden className="h-2" />
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-secondary" />}>
      <AllRecipesCatalog />
    </Suspense>
  );
}
