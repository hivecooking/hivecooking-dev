'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getHiveCustomJsonId, getRootObjectId } from '@/config/runtime';
import { useI18n } from '@/i18n';
import {
  fetchObjectPosts,
  fetchObjectRelated,
  fetchObjectSimilar,
  fetchSinglePost,
  getObjectAvatarUrl,
  getObjectDescription,
  getObjectDisplayName,
  getObjectTitle,
  getSortedListItems,
  resolveObject,
  resolveObjectsNested,
  type FeedPostItem,
  type ProjectedObjectWithCounts,
  type ResolvedListItem,
  type SinglePost,
} from '@/modules/query-api';
import { buildOdlObjectFollowOp, buildVoteOp, useWallet } from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

import { PostBodyRenderer } from './post-body-renderer';

type BreadcrumbEntry = {
  id: string;
  name: string;
};

const FALLBACK_FOOD_IMG =
  'https://waivio.nyc3.digitaloceanspaces.com/1710778615_39a508e6-39fa-49ee-8a47-82761944b893';

function parseBreadcrumbs(raw: string | null): BreadcrumbEntry[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const id = decodeURIComponent(part.slice(0, idx));
      const name = decodeURIComponent(part.slice(idx + 1));
      return id && name ? { id, name } : null;
    })
    .filter((x): x is BreadcrumbEntry => x !== null);
}

function serializeBreadcrumbs(entries: BreadcrumbEntry[]): string {
  return entries
    .map((e) => `${encodeURIComponent(e.id)}:${encodeURIComponent(e.name)}`)
    .join(',');
}

function extractItemTags(fields: Record<string, unknown> | undefined, objectType: string): string[] {
  const typeLabel = objectType.charAt(0).toUpperCase() + objectType.slice(1);
  const tags: string[] = [typeLabel];

  if (Array.isArray(fields?.tagCategoryItem)) {
    for (const raw of fields.tagCategoryItem as unknown[]) {
      if (raw && typeof raw === 'object' && 'value' in raw) {
        const val = String((raw as Record<string, unknown>).value).trim();
        if (val && !tags.includes(val)) tags.push(val);
      }
      if (tags.length >= 3) break;
    }
  }
  if (tags.length < 3 && Array.isArray(fields?.categoryItems)) {
    for (const raw of fields.categoryItems as unknown[]) {
      if (raw && typeof raw === 'object' && 'body' in raw) {
        const val = String((raw as Record<string, unknown>).body).trim();
        if (val && !tags.includes(val)) tags.push(val);
      }
      if (tags.length >= 3) break;
    }
  }
  if (tags.length < 3 && Array.isArray(fields?.departments)) {
    for (const raw of fields.departments as unknown[]) {
      const val = String(raw).trim();
      if (val && !tags.includes(val)) tags.push(val);
      if (tags.length >= 3) break;
    }
  }
  return tags.slice(0, 3);
}

function extractRatingSummary(fields: Record<string, unknown> | undefined): {
  label: string;
  stars: number;
} {
  if (Array.isArray(fields?.aggregateRating) && fields.aggregateRating.length > 0) {
    const first = fields.aggregateRating[0] as {
      dimension?: string;
      averageRating?: number | null;
    };
    const rawAvg = typeof first?.averageRating === 'number' ? first.averageRating : 0;
    const stars = rawAvg > 5 ? Math.round(rawAvg / 2000) : Math.round(rawAvg);
    return {
      label: first?.dimension || 'Rating',
      stars: Math.max(0, Math.min(5, stars)),
    };
  }
  return { label: 'Rating', stars: 0 };
}

function StarRatingDisplay({ stars, label }: { stars: number; label: string }) {
  return (
    <div className="inline-flex items-center gap-1 text-xs">
      <span className="tracking-tight">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < stars ? 'text-[#af3d36]' : 'text-[#d9d9d9]'}>
            ★
          </span>
        ))}
      </span>
      <span className="font-semibold text-[#353535]">{label}</span>
    </div>
  );
}

export function CatalogItemCard({
  item,
  href,
}: {
  item: {
    object_id: string;
    object_type: string;
    fields?: Record<string, unknown>;
    previewGallery?: Array<{ url: string; isAvatar?: boolean | null }> | null;
  };
  href: string;
}) {
  const name = getObjectDisplayName(item);
  const img = getObjectAvatarUrl(item) ?? FALLBACK_FOOD_IMG;
  const price =
    typeof item.fields?.price === 'string'
      ? item.fields.price
      : typeof item.fields?.price === 'number'
        ? `$${item.fields.price}`
        : null;
  const { stars, label } = extractRatingSummary(item.fields);
  const tags = extractItemTags(item.fields, item.object_type);
  const isRecipe = item.object_type === 'recipe';
  const isProductOrBook = item.object_type === 'product' || item.object_type === 'book';

  const rawButton = item.fields?.button as
    | { title?: string; link?: string }
    | Array<{ title?: string; link?: string }>
    | undefined;
  const buttonObj = Array.isArray(rawButton) ? rawButton[0] : rawButton;

  return (
    <div className="group relative flex flex-col items-center justify-between rounded-[4px] border border-[#e9e7e7] bg-white p-3.5 text-center transition-shadow hover:shadow-md">
      <button
        type="button"
        aria-label="Favorite"
        className="absolute top-2.5 right-2.5 z-10 text-base text-[#af3d36] hover:scale-110"
      >
        ♥
      </button>

      <Link href={href} className="flex w-full flex-col items-center">
        <div className="aspect-square w-full overflow-hidden rounded-[2px] bg-white">
          <img
            src={img}
            alt={name}
            loading="lazy"
            className={`h-full w-full ${
              isProductOrBook ? 'object-contain p-2' : 'object-cover'
            } transition-transform duration-300 group-hover:scale-105`}
          />
        </div>

        <h3 className="mt-2.5 line-clamp-2 text-[14px] font-bold leading-snug text-[#353535] group-hover:text-[#af3d36]">
          {name}
        </h3>
      </Link>

      <div className="mt-2 flex flex-col items-center gap-1">
        <StarRatingDisplay stars={stars} label={label} />

        <p className="line-clamp-2 text-xs leading-relaxed">
          {price ? (
            <>
              <span className="font-bold text-[#af3d36]">{price}</span>
              <span className="text-[#99aab5]"> · </span>
            </>
          ) : null}
          <span className="text-[#99aab5]">{tags.join(' · ')}</span>
        </p>

        {isRecipe ? (
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#044332] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <span>🥕</span>
            <span>Get Ingredients</span>
          </Link>
        ) : isProductOrBook ? (
          buttonObj?.link ? (
            <a
              href={buttonObj.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-4 py-1 text-xs font-bold text-[#111] shadow-2xs hover:border-[#af3d36]"
            >
              {buttonObj.title || 'Buy Now'}
            </a>
          ) : (
            <Link
              href={href}
              className="mt-2 inline-flex flex-col items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-4 py-1 shadow-2xs hover:border-[#af3d36]"
            >
              <span className="text-[15px] font-extrabold tracking-tight leading-none text-[#111]">
                amazon
              </span>
              <span className="mt-0.5 h-[2px] w-10 rounded-full bg-[#ff9900]" />
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

export function ObjectExplorer({
  defaultObjectId,
  initialObjectId,
  forcedObjectId,
  initialSubTab,
}: {
  defaultObjectId?: string;
  initialObjectId?: string;
  forcedObjectId?: string;
  initialSubTab?: string;
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { username, broadcast } = useWallet();

  const rootId = defaultObjectId ?? getRootObjectId();
  const currentId = forcedObjectId || initialObjectId || searchParams.get('id') || rootId;
  const pathParam = searchParams.get('path');
  const activeSubTab = initialSubTab || searchParams.get('tab') || 'default';

  const breadcrumbs = useMemo(() => parseBreadcrumbs(pathParam), [pathParam]);

  const [objectData, setObjectData] = useState<ProjectedObjectWithCounts | null>(null);
  const [nestedFallbackItems, setNestedFallbackItems] = useState<ResolvedListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [featuredPost, setFeaturedPost] = useState<SinglePost | null>(null);
  const [featuredPostLoading, setFeaturedPostLoading] = useState(false);

  const [similarObjects, setSimilarObjects] = useState<ProjectedObjectWithCounts[]>([]);
  const [relatedObjects, setRelatedObjects] = useState<ProjectedObjectWithCounts[]>([]);

  const [selectedGalleryUrl, setSelectedGalleryUrl] = useState<string | null>(null);
  const [showProductIds, setShowProductIds] = useState(false);
  const [linkedObjectsOpen, setLinkedObjectsOpen] = useState(true);
  const [hashtagsOpen, setHashtagsOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setPosts([]);
      setFeaturedPost(null);
      setSimilarObjects([]);
      setRelatedObjects([]);
      setNestedFallbackItems([]);
      setSelectedGalleryUrl(null);
      setShowProductIds(false);
      setActionStatus(null);

      const res = await resolveObject({ object_id: currentId }, controller.signal);
      if (cancelled) return;

      if (!isOk(res)) {
        setError(t('explore.error'));
        setLoading(false);
        return;
      }

      const obj = res.value;
      setObjectData(obj);
      setLoading(false);

      // If list has empty fields.listItem but sortCustom.include has IDs (e.g., 4ie2uj-shop), resolve them!
      const rawListItems = Array.isArray(obj.fields?.listItem) ? obj.fields.listItem : [];
      const sortCustom = obj.fields?.sortCustom as { include?: unknown[] } | undefined;
      if (
        obj.object_type === 'list' &&
        rawListItems.length === 0 &&
        Array.isArray(sortCustom?.include) &&
        sortCustom.include.length > 0
      ) {
        const includeIds = sortCustom.include.map((x) => String(x));
        const nestedRes = await resolveObjectsNested({ ids: includeIds }, controller.signal);
        if (!cancelled && isOk(nestedRes)) {
          setNestedFallbackItems(
            nestedRes.value.items.map((item) => ({
              object_id: item.object_id,
              object_type: item.object_type,
              fields: item.fields,
              weight: item.weight,
              isFavorited: item.isFavorited ?? undefined,
              listItemsCount: item.listItemsCount ?? undefined,
            })),
          );
        }
      }

      // Fetch posts, similar, and related for non-list objects
      if (obj.object_type !== 'list' || activeSubTab === 'threads') {
        setPostsLoading(true);
        const postsRes = await fetchObjectPosts(
          currentId,
          { limit: 15, currency: 'USD' },
          controller.signal,
        );
        if (cancelled) return;
        setPostsLoading(false);

        if (isOk(postsRes)) {
          const items = postsRes.value.items;
          setPosts(items);

          if (obj.object_type === 'recipe' && items.length > 0) {
            const first = items[0]!;
            setFeaturedPostLoading(true);
            const fullRes = await fetchSinglePost(
              first.author,
              first.permlink,
              'USD',
              controller.signal,
            );
            if (!cancelled) {
              setFeaturedPostLoading(false);
              if (isOk(fullRes)) {
                setFeaturedPost(fullRes.value);
              }
            }
          }
        }

        if (
          obj.object_type === 'recipe' ||
          obj.object_type === 'product' ||
          obj.object_type === 'book'
        ) {
          void fetchObjectSimilar(currentId, { limit: 5 }, controller.signal).then((simRes) => {
            if (!cancelled && isOk(simRes)) {
              setSimilarObjects(simRes.value.items.slice(0, 5));
            }
          });
        }

        if (obj.object_type === 'product' || obj.object_type === 'book') {
          void fetchObjectRelated(currentId, { limit: 5 }, controller.signal).then((relRes) => {
            if (!cancelled && isOk(relRes)) {
              setRelatedObjects(relRes.value.items.slice(0, 5));
            }
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSubTab, currentId, t]);

  const handleFollowObject = useCallback(async () => {
    if (!objectData) return;
    if (!username) {
      setActionStatus(t('broadcast.needConnect'));
      return;
    }
    try {
      setActionStatus(t('wallet.connecting'));
      const op = buildOdlObjectFollowOp({
        id: getHiveCustomJsonId(),
        objectId: objectData.object_id,
        method: 'follow',
        required_posting_auths: [username],
      });
      await broadcast([op]);
      setActionStatus(t('broadcast.success'));
    } catch (err) {
      setActionStatus(err instanceof Error ? err.message : t('broadcast.error'));
    }
  }, [broadcast, objectData, t, username]);

  const handleVotePost = useCallback(
    async (author: string, permlink: string) => {
      if (!username) {
        setActionStatus(t('broadcast.needConnect'));
        return;
      }
      try {
        setActionStatus(t('wallet.connecting'));
        const op = buildVoteOp(username, author, permlink, 10000);
        await broadcast([op]);
        setActionStatus(t('broadcast.success'));
      } catch (err) {
        setActionStatus(err instanceof Error ? err.message : t('broadcast.error'));
      }
    },
    [broadcast, t, username],
  );

  const sortedItems = useMemo(() => {
    if (!objectData) return [];
    const primary = getSortedListItems(objectData);
    const all = primary.length > 0 ? primary : nestedFallbackItems;
    if (objectData.object_id === '6nltas-recipes' && all.length > 1) {
      return all.filter((item) => item.object_id !== 'ugr-recipes-by-country');
    }
    return all;
  }, [nestedFallbackItems, objectData]);

  if (loading) {
    return (
      <div className="m-[5px] space-y-6 md:m-[20px]">
        <div className="h-6 w-64 animate-pulse rounded-[4px] bg-secondary" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square animate-pulse rounded-[4px] border border-[#e9e7e7] bg-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !objectData) {
    return (
      <div className="rounded-[4px] border border-[#e9e7e7] bg-white p-8 text-center">
        <p className="text-section text-error">{error ?? t('explore.error')}</p>
        <Link
          href="/object/6nltas-recipes"
          className="mt-4 inline-block rounded-[4px] bg-[#af3d36] px-4 py-2 text-body-sm font-semibold text-white"
        >
          {t('nav.byCountry')}
        </Link>
      </div>
    );
  }

  const displayName = getObjectDisplayName(objectData);
  const avatarUrl = getObjectAvatarUrl(objectData);
  const description = getObjectDescription(objectData);
  const subtitle = getObjectTitle(objectData);
  const isRootList = objectData.object_id === rootId;

  const nextBreadcrumbs: BreadcrumbEntry[] = isRootList
    ? [{ id: rootId, name: displayName }]
    : [
        ...(breadcrumbs.length > 0
          ? breadcrumbs.filter((b) => b.id !== objectData.object_id)
          : []),
        { id: objectData.object_id, name: displayName },
      ];

  const serializedNextPath = serializeBreadcrumbs(nextBreadcrumbs);

  // Gallery URLs
  const galleryUrls: string[] = [];
  if (avatarUrl) galleryUrls.push(avatarUrl);
  if (Array.isArray(objectData.previewGallery)) {
    for (const g of objectData.previewGallery) {
      if (g?.url && !galleryUrls.includes(g.url)) galleryUrls.push(g.url);
    }
  }
  if (Array.isArray(objectData.fields?.imageGalleryItem)) {
    for (const raw of objectData.fields.imageGalleryItem as unknown[]) {
      if (raw && typeof raw === 'object' && 'url' in raw) {
        const u = String((raw as Record<string, unknown>).url);
        if (u && !galleryUrls.includes(u)) galleryUrls.push(u);
      }
    }
  }
  const activeHeroImage = selectedGalleryUrl ?? galleryUrls[0] ?? FALLBACK_FOOD_IMG;

  // ============================================================================
  // 1. LIST OBJECT LAYOUT (Matches hivecooking.com .Checklist 1:1)
  // ============================================================================
  if (objectData.object_type === 'list') {
    const allSubLists =
      sortedItems.length > 0 && sortedItems.every((item) => item.object_type === 'list');

    return (
      <div className="Checklist m-[5px] md:m-[20px]">
        {/* Top Breadcrumbs + Commission Notice (.Checklist__breadcrumbsContainre) */}
        <div className="Checklist__breadcrumbsContainre flex flex-col items-center justify-between md:h-[47px] md:flex-row">
          <div className="flex items-center">
            <div className="Breadcrumbs my-[10px] flex h-[27px] items-center text-[18px] leading-[27px] font-normal text-[#99aab5]">
              {!isRootList ? (
                <>
                  {breadcrumbs.map((crumb, idx) => {
                    const priorPath = serializeBreadcrumbs(breadcrumbs.slice(0, idx));
                    const href = `/object/${encodeURIComponent(crumb.id)}${
                      priorPath ? `?path=${encodeURIComponent(priorPath)}` : ''
                    }`;
                    return (
                      <span key={`${crumb.id}-${idx}`} className="flex items-center">
                        <Link
                          href={href}
                          className="text-[#99aab5] hover:text-[#af3d36] hover:underline"
                        >
                          {crumb.name}
                        </Link>
                        <span className="mx-1.5">&gt;</span>
                      </span>
                    );
                  })}
                  <Link
                    href={`/object/${encodeURIComponent(objectData.object_id)}`}
                    className="text-[#99aab5] hover:text-[#af3d36]"
                  >
                    {displayName}
                  </Link>
                </>
              ) : null}
            </div>
            {username ? (
              <button
                type="button"
                onClick={() => void handleFollowObject()}
                className="ml-3 h-[30px] rounded-[4px] border border-[#e9e7e7] bg-white px-[15px] text-[16px] font-normal text-[rgba(0,0,0,0.65)] hover:border-[#af3d36]"
              >
                Edit
              </button>
            ) : null}
          </div>

          <div className="text-right text-[16px] leading-[24px] font-normal text-[#a4adb8]">
            Earns commissions on purchases
          </div>
        </div>

        {/* 5-Column Flex Wrap Grid (.Checklist__list) */}
        {sortedItems.length > 0 ? (
          <div className="Checklist__list flex flex-wrap gap-[10px]">
            {sortedItems.map((item: ResolvedListItem) => {
              const itemHref = `/object/${encodeURIComponent(item.object_id)}?path=${encodeURIComponent(serializedNextPath)}`;

              if (item.object_type === 'list') {
                const itemName = getObjectDisplayName(item);
                const itemImg = getObjectAvatarUrl(item) ?? FALLBACK_FOOD_IMG;
                const count = item.listItemsCount;

                return (
                  <div
                    key={item.object_id}
                    className="Checklist__listItems relative mb-[10px] flex w-[calc(50%-5px)] flex-col rounded-[4px] sm:w-[calc(33.3333%-6.66667px)] lg:w-[calc(25%-7.5px)] xl:w-[calc(20%-8px)]"
                  >
                    <Link href={itemHref} title={itemName} className="flex w-full flex-col">
                      <div
                        className="Checklist__itemsAvatar flex h-[calc(50vw-5px)] w-full items-center justify-center rounded-t-[4px] border border-b-0 border-[#e9e7e7] bg-white bg-cover bg-[50%_center] bg-no-repeat transition-shadow duration-500 hover:shadow-[inset_-11px_11px_24px_-14px_#93312b] sm:h-[calc(33.3333vw-6.66667px)] lg:h-[calc(25vw-7.5px)] xl:h-[calc(20vw-8px)]"
                        style={{ backgroundImage: `url("${itemImg}")` }}
                      >
                        <img
                          className="Checklist__itemsAvatarImg hidden"
                          src={itemImg}
                          alt={itemName}
                        />
                      </div>
                      <span className="Checklist__itemsTitle block h-[33px] w-full rounded-b-[4px] bg-[#af3d36] px-[10px] py-[3px] text-[18px] leading-[27px] font-semibold text-white">
                        {itemName}
                        {typeof count === 'number' && count >= 0 ? (
                          <span className="items-count ml-[5px] inline-block font-semibold text-white">
                            {' '}({count})
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </div>
                );
              }

              return (
                <div
                  key={item.object_id}
                  className="mb-[10px] w-[calc(50%-5px)] sm:w-[calc(33.3333%-6.66667px)] lg:w-[calc(25%-7.5px)] xl:w-[calc(20%-8px)]"
                >
                  <CatalogItemCard item={item} href={itemHref} />
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Bottom SEO Title & Description Block (Only on leaf product/recipe lists, not pure sub-list tile grids) */}
        {!allSubLists && (subtitle || description) ? (
          <section className="mx-auto max-w-4xl space-y-3 pt-6 pb-4 text-[#353535]">
            {subtitle ? (
              <h2 className="text-[20px] font-semibold text-[#af3d36]">{subtitle}</h2>
            ) : null}
            {description ? (
              <div className="whitespace-pre-line text-body leading-relaxed text-[#353535]">
                {description}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    );
  }

  // ============================================================================
  // 2. RECIPE OBJECT LAYOUT (Matches hivecooking.com/object/yrc-spaghetti-carbonara 1:1)
  // ============================================================================
  if (objectData.object_type === 'recipe') {
    const ingredients = Array.isArray(objectData.fields?.ingredients)
      ? (objectData.fields.ingredients as unknown[]).map((x) => String(x))
      : Array.isArray(objectData.fields?.recipeIngredients)
        ? (objectData.fields.recipeIngredients as unknown[]).map((x) => String(x))
        : [];

    const { stars, label: ratingLabel } = extractRatingSummary(objectData.fields);

    const categoryValues: string[] = [];
    if (Array.isArray(objectData.fields?.category)) {
      for (const c of objectData.fields.category as unknown[]) {
        categoryValues.push(String(c));
      }
    }
    if (Array.isArray(objectData.fields?.tagCategoryItem)) {
      for (const raw of objectData.fields.tagCategoryItem as unknown[]) {
        if (raw && typeof raw === 'object' && 'value' in raw) {
          const val = String((raw as Record<string, unknown>).value);
          if (val && !categoryValues.includes(val)) categoryValues.push(val);
        }
      }
    }

    const calories =
      typeof objectData.fields?.calories === 'string' ||
      typeof objectData.fields?.calories === 'number'
        ? String(objectData.fields.calories)
        : typeof objectData.fields?.nutrition === 'string'
          ? objectData.fields.nutrition
          : null;
    const cookingTime =
      typeof objectData.fields?.cookingTime === 'string' ||
      typeof objectData.fields?.cookingTime === 'number'
        ? String(objectData.fields.cookingTime)
        : null;

    return (
      <div className="mx-auto max-w-container-content space-y-10 px-gutter py-section-y pt-2">
        {/* Top 2-Column Recipe Hero */}
        <section className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {/* Left: Square Image + Thumbnails */}
          <div className="flex flex-col items-center">
            <div className="aspect-square w-full max-w-[430px] overflow-hidden rounded-[2px] bg-white">
              <img
                src={activeHeroImage}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            </div>
            {galleryUrls.length > 0 ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {galleryUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedGalleryUrl(url)}
                    className={`h-11 w-11 overflow-hidden rounded-[2px] border-2 ${
                      activeHeroImage === url ? 'border-[#353535]' : 'border-transparent opacity-75'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: Recipe Info + Ingredients */}
          <div className="space-y-3 text-[#353535]">
            <h1 className="text-[22px] font-bold leading-snug text-[#353535]">{displayName}</h1>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleFollowObject()}
                className="rounded-[4px] bg-[#af3d36] px-4 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                Follow
              </button>
              <button
                type="button"
                className="rounded-[4px] border border-[#d9d9d9] bg-white px-3.5 py-1 text-xs text-[#353535] hover:border-[#af3d36]"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label="Favorite"
                className="ml-1 text-lg text-[#99aab5] hover:text-[#af3d36]"
              >
                ♥
              </button>
            </div>

            {actionStatus ? (
              <p className="text-xs font-medium text-[#af3d36]">{actionStatus}</p>
            ) : null}

            <div>
              <StarRatingDisplay stars={stars} label={ratingLabel} />
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-[#044332] px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95"
              >
                <span>🥕</span>
                <span>Get Recipe Ingredients</span>
              </button>
              <p className="mt-1 pl-3 text-[11px] text-[#99aab5]">
                Earns commissions on purchases
              </p>
            </div>

            {ingredients.length > 0 ? (
              <div className="pt-2">
                <h2 className="text-xs font-bold text-[#353535]">Recipe ingredients:</h2>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] text-[#af3d36]">
                  {ingredients.map((ing, idx) => (
                    <li key={idx} className="marker:text-[#353535]">
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-1.5 pt-2 text-xs">
              {cookingTime ? (
                <p>
                  <strong className="text-[#353535]">Cooking time: </strong>
                  <span className="text-[#99aab5]">{cookingTime}</span>
                </p>
              ) : null}
              {calories ? (
                <p>
                  <strong className="text-[#353535]">Calories: </strong>
                  <span className="text-[#99aab5]">{calories}</span>
                </p>
              ) : null}
              <p>
                <strong className="text-[#353535]">Product IDs: </strong>
                <button
                  type="button"
                  onClick={() => setShowProductIds((v) => !v)}
                  className="text-[#af3d36] hover:underline"
                >
                  {showProductIds ? '(hide)' : '(show)'}
                </button>
                {showProductIds ? (
                  <span className="ml-2 font-mono text-[#99aab5]">{objectData.object_id}</span>
                ) : null}
              </p>
              {categoryValues.length > 0 ? (
                <p>
                  <strong className="text-[#353535]">Categories: </strong>
                  <span className="text-[#99aab5]">{categoryValues.join(', ')}</span>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Middle Centered "Top Recipe" Post Box */}
        {featuredPostLoading ? (
          <div className="mx-auto h-96 max-w-[740px] animate-pulse rounded-[4px] border border-[#e9e7e7] bg-white p-6" />
        ) : featuredPost ? (
          <section className="mx-auto max-w-[740px] rounded-[4px] border border-[#e9e7e7] bg-white p-6 shadow-2xs">
            <div className="relative text-center">
              <span className="absolute top-0 right-0 text-sm text-[#99aab5]" title="Pinned">
                📌
              </span>
              <p className="text-[22px] font-bold text-[#353535]">Top Recipe</p>
              <h2 className="mt-1 text-[22px] font-bold text-[#353535]">
                <Link
                  href={`/@${encodeURIComponent(featuredPost.author ?? '')}/${encodeURIComponent(featuredPost.permlink)}`}
                  className="hover:text-[#af3d36]"
                >
                  {featuredPost.title}
                </Link>
              </h2>
            </div>

            <div className="mt-4 flex items-center justify-between border-b border-[#e9e7e7] pb-4">
              <Link
                href={`/@${encodeURIComponent(featuredPost.author ?? '')}`}
                className="flex items-center gap-3 hover:opacity-90"
              >
                {featuredPost.authorProfile?.avatarUrl ? (
                  <img
                    src={featuredPost.authorProfile.avatarUrl}
                    alt={featuredPost.author ?? ''}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#af3d36] font-bold text-white">
                    {(featuredPost.author ?? 'H')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#353535]">
                      {featuredPost.author}
                    </span>
                    {featuredPost.authorProfile?.reputation !== undefined &&
                    featuredPost.authorProfile?.reputation !== null ? (
                      <span className="rounded-[2px] border border-[#e9e7e7] px-1.5 py-0.2 text-[10px] font-semibold text-[#353535]">
                        {featuredPost.authorProfile.reputation}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#99aab5]">
                    {featuredPost.createdAt
                      ? new Date(featuredPost.createdAt).toLocaleDateString()
                      : ''}{' '}
                    · Waivio · 3 min read
                  </p>
                </div>
              </Link>
              <span className="text-lg text-[#af3d36]">•••</span>
            </div>

            {featuredPost.videoEmbedUrl ? (
              <div className="my-5 aspect-video w-full overflow-hidden rounded-[2px] bg-black">
                <iframe
                  src={featuredPost.videoEmbedUrl.replace('autoplay=1', 'autoplay=0')}
                  title={featuredPost.title ?? 'Recipe Video'}
                  className="h-full w-full border-0"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}

            {featuredPost.body ? (
              <div className="mt-5 font-serif text-[16px] leading-relaxed text-[#353535]">
                <PostBodyRenderer body={featuredPost.body} />
              </div>
            ) : null}

            {/* Linked Objects Accordion */}
            <div className="mt-6 rounded-[4px] border border-[#e9e7e7] bg-[#fafafa]">
              <button
                type="button"
                onClick={() => setLinkedObjectsOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-[#353535]"
              >
                <span>{linkedObjectsOpen ? '⌄' : '›'}</span>
                <span>Linked objects {(featuredPost.objects ?? [objectData]).length}</span>
              </button>
              {linkedObjectsOpen ? (
                <div className="border-t border-[#e9e7e7] bg-white p-4">
                  <div className="mx-auto flex max-w-md items-center justify-between gap-4 rounded-[4px] border border-[#e9e7e7] p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={activeHeroImage}
                        alt={displayName}
                        className="h-16 w-16 rounded-[2px] object-cover"
                      />
                      <div>
                        <p className="text-sm font-bold text-[#353535]">{displayName}</p>
                        <StarRatingDisplay stars={stars} label={ratingLabel} />
                        <p className="text-xs text-[#99aab5]">Recipe</p>
                      </div>
                    </div>
                    <span className="text-[#99aab5]">♥</span>
                  </div>
                  <p className="mt-3 text-center text-[11px] text-[#99aab5]">
                    This post contains affiliate links. Commissions may be earned from purchases
                    made through these links at no extra cost to the buyer.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setHashtagsOpen((v) => !v)}
                className="flex w-full items-center gap-2 border-t border-[#e9e7e7] px-4 py-2 text-left text-xs font-semibold text-[#353535]"
              >
                <span>{hashtagsOpen ? '⌄' : '›'}</span>
                <span>Hashtags {categoryValues.length}</span>
              </button>
            </div>

            {/* Post Vote & Reward Footer */}
            <div className="mt-4 flex items-center justify-between border-b border-[#e9e7e7] pb-3 text-xs text-[#99aab5]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    featuredPost.author &&
                    void handleVotePost(featuredPost.author, featuredPost.permlink)
                  }
                  className="flex items-center gap-1 hover:text-[#af3d36]"
                >
                  <span>👍</span>
                  <span>{featuredPost.votes?.totalCount ?? 0}</span>
                </button>
                <span>💬 {featuredPost.children ?? 0}</span>
                <span>🔄</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#af3d36]">
                  {featuredPost.reward?.label ?? '$0.00'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    featuredPost.author &&
                    void handleVotePost(featuredPost.author, featuredPost.permlink)
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[#af3d36] text-[10px] text-white"
                >
                  ▲
                </button>
              </div>
            </div>

            {/* Comments Section */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#353535]">Comments</h3>
                <span className="text-xs text-[#99aab5]">Sort by Best ⌄</span>
              </div>
              <div className="mt-3 rounded-[4px] border border-[#e9e7e7] bg-[#fafafa] p-3 text-xs text-[#99aab5]">
                {username
                  ? 'Write a comment...'
                  : 'Connect with Hive Keychain to post a comment.'}
              </div>
            </div>
          </section>
        ) : null}

        {/* SIMILAR Section */}
        {similarObjects.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">SIMILAR</h2>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {similarObjects.map((sim) => (
                <CatalogItemCard
                  key={sim.object_id}
                  item={sim}
                  href={`/object/${encodeURIComponent(sim.object_id)}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* USER REVIEWS Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">
              USER REVIEWS
            </h2>
            <span className="text-xs font-bold text-[#af3d36] uppercase">WRITE REVIEW</span>
          </div>
          {posts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {posts.map((post) => {
                const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl ?? activeHeroImage;
                const postHref = `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
                return (
                  <article
                    key={`${post.author}/${post.permlink}`}
                    className="flex flex-col justify-between overflow-hidden rounded-[4px] border border-[#e9e7e7] bg-white shadow-2xs"
                  >
                    <Link href={postHref}>
                      <img
                        src={thumb}
                        alt={post.title ?? ''}
                        loading="lazy"
                        className="h-44 w-full object-cover hover:opacity-90"
                      />
                    </Link>
                    <div className="p-3">
                      <Link
                        href={postHref}
                        className="line-clamp-1 text-xs font-bold text-[#353535] hover:text-[#af3d36]"
                      >
                        {post.title || post.permlink}
                      </Link>
                      <p className="mt-1 text-[11px] text-[#99aab5]">@{post.author}</p>
                      <div className="mt-2 flex items-center justify-between border-t border-[#e9e7e7] pt-2 text-[11px] text-[#99aab5]">
                        <span>
                          👍 {post.votes?.totalCount ?? 0} · 💬 {post.children ?? 0}
                        </span>
                        <span className="font-bold text-[#af3d36]">
                          {post.reward?.label ?? '$0.00'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  // ============================================================================
  // 3. PRODUCT / BOOK / GENERAL OBJECT LAYOUT (Matches ref_product_detail.png 1:1)
  // ============================================================================
  const price =
    typeof objectData.fields?.price === 'string'
      ? objectData.fields.price
      : typeof objectData.fields?.price === 'number'
        ? `$${objectData.fields.price}`
        : null;
  const compareAtPrice =
    typeof objectData.fields?.compareAtPrice === 'string'
      ? objectData.fields.compareAtPrice
      : null;

  const rawButton = objectData.fields?.button as
    | { title?: string; link?: string }
    | Array<{ title?: string; link?: string }>
    | undefined;
  const buttonObj = Array.isArray(rawButton) ? rawButton[0] : rawButton;

  const rawWebsite = objectData.fields?.website as
    | { title?: string; link?: string }
    | Array<{ title?: string; link?: string }>
    | undefined;
  const websiteObj = Array.isArray(rawWebsite) ? rawWebsite[0] : rawWebsite;

  const brandEntry = (objectData.fields?.brand ??
    objectData.fields?.merchant ??
    objectData.fields?.manufacturer ??
    objectData.fields?.publisher) as
    | { object_id?: string; fields?: Record<string, unknown> }
    | undefined;
  const brandName = brandEntry?.object_id
    ? getObjectDisplayName({ object_id: brandEntry.object_id, fields: brandEntry.fields })
    : null;

  const ratingsList: Array<{ dimension: string; stars: number }> = Array.isArray(
    objectData.fields?.aggregateRating,
  )
    ? (objectData.fields.aggregateRating as unknown[]).flatMap((r) => {
        if (r && typeof r === 'object') {
          const rec = r as { dimension?: string; averageRating?: number | null };
          const avg = typeof rec.averageRating === 'number' ? rec.averageRating : 0;
          const stars = avg > 5 ? Math.round(avg / 2000) : Math.round(avg);
          return [{ dimension: rec.dimension || 'Rating', stars: Math.max(0, Math.min(5, stars)) }];
        }
        return [];
      })
    : [{ dimension: 'Rating', stars: 0 }];

  const featureList: Array<{ key: string; value: string }> = Array.isArray(
    objectData.fields?.featureList,
  )
    ? (objectData.fields.featureList as unknown[]).flatMap((item) => {
        if (item && typeof item === 'object' && 'key' in item && 'value' in item) {
          const r = item as Record<string, unknown>;
          return [{ key: String(r.key), value: String(r.value) }];
        }
        return [];
      })
    : [];

  const tagCategoryItems: Array<{ category: string; value: string }> = Array.isArray(
    objectData.fields?.tagCategoryItem,
  )
    ? (objectData.fields.tagCategoryItem as unknown[]).flatMap((item) => {
        if (item && typeof item === 'object' && 'category' in item && 'value' in item) {
          const r = item as Record<string, unknown>;
          return [{ category: String(r.category), value: String(r.value) }];
        }
        return [];
      })
    : [];

  const groupedTags = new Map<string, string[]>();
  for (const tci of tagCategoryItems) {
    const list = groupedTags.get(tci.category) ?? [];
    if (!list.includes(tci.value)) list.push(tci.value);
    groupedTags.set(tci.category, list);
  }

  const departments = Array.isArray(objectData.fields?.departments)
    ? (objectData.fields.departments as unknown[]).map((x) => String(x))
    : [];
  const weightText =
    objectData.fields?.weight && typeof objectData.fields.weight === 'object'
      ? `${(objectData.fields.weight as { value?: unknown }).value ?? ''} ${(objectData.fields.weight as { unit?: unknown }).unit ?? ''}`.trim()
      : null;
  const dimensionsObj = objectData.fields?.dimensions as
    | { length?: unknown; width?: unknown; height?: unknown; unit?: unknown }
    | undefined;
  const dimensionsText =
    dimensionsObj && (dimensionsObj.length || dimensionsObj.width || dimensionsObj.height)
      ? `${dimensionsObj.length ?? ''} x ${dimensionsObj.width ?? ''} x ${dimensionsObj.height ?? ''} ${dimensionsObj.unit ?? ''}`.trim()
      : null;

  const descParagraphs = description
    ? description
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const htmlContent =
    typeof objectData.fields?.htmlContent === 'string' ? objectData.fields.htmlContent : null;
  const pageContent =
    typeof objectData.fields?.pageContent === 'string' ? objectData.fields.pageContent : null;

  const isProductOrBook =
    objectData.object_type === 'product' || objectData.object_type === 'book';

  return (
    <div className="mx-auto max-w-container-content space-y-10 px-gutter py-section-y pt-2">
      {/* Top 2-Column Hero */}
      <section className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        {/* Left: Main Photo + Thumbnail Strip */}
        <div className="flex flex-col items-center">
          <div className="aspect-square w-full max-w-[430px] overflow-hidden rounded-[2px] bg-white">
            <img
              src={activeHeroImage}
              alt={displayName}
              className={`h-full w-full ${isProductOrBook ? 'object-contain p-2' : 'object-cover'}`}
            />
          </div>
          {galleryUrls.length > 1 ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {galleryUrls.slice(0, 8).map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setSelectedGalleryUrl(url)}
                  className={`h-12 w-12 overflow-hidden rounded-[2px] border-2 bg-white ${
                    activeHeroImage === url ? 'border-[#353535]' : 'border-[#e9e7e7] opacity-80'
                  }`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right: Title, Brand, Follow/Edit, Ratings, Price, Buy Button */}
        <div className="space-y-3 text-[#353535]">
          <div>
            <h1 className="text-[22px] font-bold leading-snug text-[#353535]">{displayName}</h1>
            {brandEntry?.object_id && brandName ? (
              <Link
                href={`/object/${encodeURIComponent(brandEntry.object_id)}`}
                className="mt-0.5 inline-block text-xs font-medium text-[#af3d36] hover:underline"
              >
                {brandName}
              </Link>
            ) : subtitle ? (
              <p className="mt-0.5 text-xs text-[#99aab5]">{subtitle}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleFollowObject()}
              className="rounded-[4px] bg-[#af3d36] px-4 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Follow
            </button>
            <button
              type="button"
              className="rounded-[4px] border border-[#d9d9d9] bg-white px-3.5 py-1 text-xs text-[#353535] hover:border-[#af3d36]"
            >
              Edit
            </button>
            <button
              type="button"
              aria-label="Favorite"
              className="ml-1 text-lg text-[#af3d36] hover:scale-110"
            >
              ♥
            </button>
          </div>

          {actionStatus ? (
            <p className="text-xs font-medium text-[#af3d36]">{actionStatus}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            {ratingsList.map((r, i) => (
              <StarRatingDisplay key={`${r.dimension}-${i}`} stars={r.stars} label={r.dimension} />
            ))}
          </div>

          {(price || compareAtPrice) ? (
            <div className="flex items-baseline gap-2.5 pt-1">
              {price ? (
                <span className="text-[20px] font-bold text-[#af3d36]">{price}</span>
              ) : null}
              {compareAtPrice ? (
                <span className="text-sm text-[#99aab5] line-through">{compareAtPrice}</span>
              ) : null}
            </div>
          ) : null}

          {(buttonObj?.link || websiteObj?.link || isProductOrBook) ? (
            <div className="pt-2">
              <p className="text-[11px] font-medium text-[#99aab5] uppercase">BUY IT ON:</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {buttonObj?.link ? (
                  <a
                    href={buttonObj.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-5 py-2 text-sm font-bold text-[#111] shadow-2xs hover:border-[#af3d36]"
                  >
                    {buttonObj.title || 'Buy Now'}
                  </a>
                ) : isProductOrBook ? (
                  <div className="inline-flex flex-col items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-5 py-1.5 shadow-2xs">
                    <span className="text-[18px] font-extrabold tracking-tight leading-none text-[#111]">
                      amazon
                    </span>
                    <span className="mt-0.5 h-[2px] w-12 rounded-full bg-[#ff9900]" />
                  </div>
                ) : null}
                {websiteObj?.link && websiteObj.link !== buttonObj?.link ? (
                  <a
                    href={websiteObj.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-4 py-2 text-xs font-semibold text-[#353535] hover:border-[#af3d36]"
                  >
                    {websiteObj.title || 'Website'} ↗
                  </a>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-[#99aab5]">Earns commissions on purchases</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ABOUT Section (Alternating 2-Column Text & Gallery Photos matching hivecooking.com) */}
      {descParagraphs.length > 0 ? (
        <section className="space-y-6">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">ABOUT</h2>
          <div className="mx-auto max-w-5xl space-y-8">
            {descParagraphs.map((para, idx) => {
              const pairImg = galleryUrls[idx + 1];
              if (!pairImg) {
                return (
                  <p key={idx} className="text-sm leading-relaxed text-[#595959]">
                    {para}
                  </p>
                );
              }
              const imgOnRight = idx % 2 === 0;
              return (
                <div
                  key={idx}
                  className="grid items-center gap-8 md:grid-cols-2"
                >
                  {imgOnRight ? (
                    <>
                      <p className="text-sm leading-relaxed text-[#595959]">{para}</p>
                      <div className="flex justify-center">
                        <img
                          src={pairImg}
                          alt=""
                          loading="lazy"
                          className="max-h-80 rounded-[2px] object-contain"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <img
                          src={pairImg}
                          alt=""
                          loading="lazy"
                          className="max-h-80 rounded-[2px] object-contain"
                        />
                      </div>
                      <p className="text-sm leading-relaxed text-[#595959]">{para}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* HTML / Page Content (for Services `html` & Links `page` objects) */}
      {htmlContent ? (
        <section className="rounded-[4px] border border-[#e9e7e7] bg-white p-6">
          <div
            className="prose max-w-none text-body text-[#353535]"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </section>
      ) : null}

      {pageContent ? (
        <section className="rounded-[4px] border border-[#e9e7e7] bg-white p-6">
          <PostBodyRenderer body={pageContent} />
        </section>
      ) : null}

      {/* PRODUCT DETAILS Section */}
      {isProductOrBook ? (
        <section className="space-y-2 text-xs">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">
            PRODUCT DETAILS
          </h2>
          <div className="space-y-1.5 pl-4">
            {weightText ? (
              <p>
                <strong className="text-[#353535]">Weight: </strong>
                <span className="text-[#99aab5]">{weightText}</span>
              </p>
            ) : null}
            {dimensionsText ? (
              <p>
                <strong className="text-[#353535]">Dimensions: </strong>
                <span className="text-[#99aab5]">{dimensionsText}</span>
              </p>
            ) : null}
            {departments.length > 0 ? (
              <p>
                <strong className="text-[#353535]">Departments: </strong>
                <span className="text-[#99aab5]">{departments.join(', ')}</span>
              </p>
            ) : null}
            <p>
              <strong className="text-[#353535]">Product IDs: </strong>
              <button
                type="button"
                onClick={() => setShowProductIds((v) => !v)}
                className="text-[#af3d36] hover:underline"
              >
                {showProductIds ? '(hide)' : '(show)'}
              </button>
              {showProductIds ? (
                <span className="ml-2 font-mono text-[#99aab5]">{objectData.object_id}</span>
              ) : null}
            </p>
          </div>
        </section>
      ) : null}

      {/* FEATURES Section */}
      {featureList.length > 0 ? (
        <section className="space-y-2 text-xs">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">FEATURES</h2>
          <div className="space-y-1.5 pl-4">
            {featureList.map((feat, idx) => (
              <p key={`${feat.key}-${idx}`}>
                <strong className="text-[#353535]">{feat.key}: </strong>
                <span className="text-[#99aab5]">{feat.value}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* SIMILAR Section */}
      {similarObjects.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">SIMILAR</h2>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {similarObjects.map((sim) => (
              <CatalogItemCard
                key={sim.object_id}
                item={sim}
                href={`/object/${encodeURIComponent(sim.object_id)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* RELATED ITEMS Section */}
      {relatedObjects.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">
            RELATED ITEMS
          </h2>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {relatedObjects.map((rel) => (
              <CatalogItemCard
                key={rel.object_id}
                item={rel}
                href={`/object/${encodeURIComponent(rel.object_id)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* TAGS Section */}
      {groupedTags.size > 0 ? (
        <section className="space-y-2 text-xs">
          <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">TAGS</h2>
          <div className="space-y-2 pl-4">
            {Array.from(groupedTags.entries()).map(([category, values]) => (
              <div key={category} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[#99aab5]">{category}:</span>
                {values.map((val) => (
                  <span
                    key={val}
                    className="rounded-[4px] border border-[#af3d36]/40 bg-[#af3d36]/5 px-2.5 py-0.5 text-xs text-[#af3d36]"
                  >
                    {val}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* USER REVIEWS / Posts Feed */}
      {(isProductOrBook || posts.length > 0 || !postsLoading) ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-[#353535] uppercase">
              USER REVIEWS
            </h2>
            <span className="text-xs font-bold text-[#af3d36] uppercase">WRITE REVIEW</span>
          </div>
          {posts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {posts.map((post) => {
                const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl ?? activeHeroImage;
                const postHref = `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
                return (
                  <article
                    key={`${post.author}/${post.permlink}`}
                    className="flex flex-col justify-between overflow-hidden rounded-[4px] border border-[#e9e7e7] bg-white shadow-2xs"
                  >
                    <Link href={postHref}>
                      <img
                        src={thumb}
                        alt={post.title ?? ''}
                        loading="lazy"
                        className="h-44 w-full object-cover hover:opacity-90"
                      />
                    </Link>
                    <div className="p-3">
                      <Link
                        href={postHref}
                        className="line-clamp-1 text-xs font-bold text-[#353535] hover:text-[#af3d36]"
                      >
                        {post.title || post.permlink}
                      </Link>
                      <p className="mt-1 text-[11px] text-[#99aab5]">@{post.author}</p>
                      <div className="mt-2 flex items-center justify-between border-t border-[#e9e7e7] pt-2 text-[11px] text-[#99aab5]">
                        <span>
                          👍 {post.votes?.totalCount ?? 0} · 💬 {post.children ?? 0}
                        </span>
                        <span className="font-bold text-[#af3d36]">
                          {post.reward?.label ?? '$0.00'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
