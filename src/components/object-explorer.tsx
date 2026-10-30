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
    const stars = rawAvg > 5 ? Math.round(rawAvg / 20) : Math.round(rawAvg);
    return {
      label: first?.dimension || 'Rating',
      stars: Math.max(0, Math.min(5, stars)),
    };
  }
  return { label: 'Rating', stars: 0 };
}

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const days = diffSec / 86400;
  if (days >= 548) return `${Math.round(days / 365)} years ago`;
  if (days >= 320) return 'a year ago';
  if (days >= 45) return `${Math.round(days / 30)} months ago`;
  if (days >= 26) return 'a month ago';
  if (days >= 1.5) return `${Math.round(days)} days ago`;
  if (days >= 0.9) return 'a day ago';
  const hours = Math.round(diffSec / 3600);
  if (hours >= 2) return `${hours} hours ago`;
  if (hours >= 1) return 'an hour ago';
  return 'just now';
}

function estimateReadingTime(body: string | null | undefined): number {
  if (!body) return 1;
  const plain = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#*_~`>|[\]()!-]/g, ' ')
    .trim();
  const words = plain ? plain.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

function StarRatingDisplay({
  stars,
  label,
  variant = 'card',
}: {
  stars: number;
  label: string;
  variant?: 'social' | 'card';
}) {
  const isSocial = variant === 'social';
  return (
    <div className="RatingsWrap py-[5px]">
      <div className="ant-row flex">
        <div
          className={`ant-col ant-col-24 RatingsWrap__rate flex ${
            isSocial ? 'RatingsWrap__socialRate h-[22px] items-end' : 'items-center'
          }`}
        >
          <div
            className={
              isSocial
                ? 'RatingsWrap__socialStars flex h-[20px] w-[115px] items-center leading-[20px]'
                : 'RatingsWrap__stars'
            }
          >
            <ul className="ant-rate m-0 flex list-none p-0 leading-none">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className={`${
                    isSocial ? 'mr-[3px] text-[20px]' : 'mr-[1px] text-[16px]'
                  } flex items-center leading-none ${
                    i < stars ? 'text-[#af3d36]' : 'text-[#e8e8e8]'
                  }`}
                >
                  <i aria-label="icon: star" className="anticon anticon-star inline-flex">
                    <svg
                      viewBox="64 64 896 896"
                      focusable="false"
                      data-icon="star"
                      width="1em"
                      height="1em"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M908.1 353.1l-253.9-36.9L540.7 86.1c-3.1-6.3-8.2-11.4-14.5-14.5-15.8-7.8-35-1.3-42.9 14.5L369.8 316.2l-253.9 36.9c-7 1-13.4 4.3-18.3 9.3a32.05 32.05 0 0 0 .6 45.3l183.7 179.1-43.4 252.9a31.95 31.95 0 0 0 46.4 33.7L512 754l227.1 119.4c6.2 3.3 13.4 4.4 20.3 3.2 17.4-3 29.1-19.5 26.1-36.9l-43.4-252.9 183.7-179.1c5-4.9 8.3-11.3 9.3-18.3 2.7-17.5-9.5-33.7-27-36.3z" />
                    </svg>
                  </i>
                </li>
              ))}
            </ul>
          </div>
          <span
            className={`pl-[5px] text-[16px] leading-[24px] font-medium whitespace-nowrap ${
              isSocial
                ? 'RatingsWrap__rate-title-black -mb-[2px] text-black'
                : 'RatingsWrap__rate-title text-[rgba(0,0,0,0.65)]'
            }`}
          >
            {label}
          </span>
        </div>
      </div>
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
  const { username } = useWallet();
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
    <div className="ShopObjectCard group relative mb-[10px] flex h-full w-full flex-col items-center justify-between rounded-[4px] border border-[#e9e7e7] bg-white px-[10px] pt-[35px] pb-[10px] text-center transition-transform duration-300 md:hover:-translate-y-[5px]">
      {username ? (
        <button
          type="button"
          aria-label="Favorite"
          className="HeartButton absolute top-[10px] right-[10px] z-10 text-base text-[#af3d36] hover:scale-110"
        >
          ♥
        </button>
      ) : null}

      <div className="flex w-full flex-col items-center">
        <div className="ShopObjectCard__topInfoWrap">
          <Link
            href={href}
            className="ShopObjectCard__avatarWrap flex h-[175px] w-[175px] items-start justify-center overflow-hidden md:h-[225px] md:w-[225px]"
          >
            <img
              src={img}
              alt={name}
              loading="lazy"
              className={`h-full w-full ${
                isProductOrBook ? 'object-contain p-1' : 'object-cover'
              }`}
            />
          </Link>
        </div>

        <Link
          href={href}
          title={name}
          className="ShopObjectCard__name mt-[10px] line-clamp-2 px-[10px] text-center text-[16px] leading-[24px] font-medium text-black hover:text-black"
        >
          {name}
        </Link>

        <StarRatingDisplay stars={stars} label={label} variant="card" />

        <div className="ObjectCardView__tag-text mt-[2px] line-clamp-2 text-center text-[16px] leading-[24px] text-[rgba(0,0,0,0.65)]">
          {price ? (
            <>
              <span className="ShopObjectCard__price font-semibold text-[#af3d36]">{price}</span>
              <span className="mx-1 text-[rgba(0,0,0,0.65)]">&bull;</span>
            </>
          ) : null}
          <span>{tags.join(' • ')}</span>
        </div>
      </div>

      <div className="ShopObjectCard__affiliatLinksWrap mt-2 flex w-full justify-center">
        {isRecipe ? (
          <div className="ShopObjectCard__affiliatLinks my-[5px] flex justify-center md:my-[15px]">
            <Link
              href={href}
              className="btn btn-acct AffiliatLink instacart inline-flex h-[46px] min-w-[200px] items-center justify-center gap-[8px] rounded-[24px] bg-[#003d29] px-[18px] py-[16px] text-[16px] font-medium whitespace-nowrap text-[#faf1e5] hover:opacity-90"
            >
              <img
                className="instacart mr-[2px] h-[22px]"
                src="https://hivecooking.com/images/Instacart-logo-carrot.svg"
                alt="Instacart logo"
              />
              <span>Get Ingredients</span>
            </Link>
          </div>
        ) : isProductOrBook ? (
          <div className="ShopObjectCard__affiliatLinks my-[5px] flex justify-center md:my-[15px]">
            {buttonObj?.link ? (
              <a
                href={buttonObj.link}
                target="_blank"
                rel="noopener noreferrer"
                className="AffiliatLink inline-flex h-[42px] max-w-[122px] items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-3 text-xs font-bold text-[#111] hover:border-[#af3d36]"
              >
                {buttonObj.title || 'Buy Now'}
              </a>
            ) : (
              <Link
                href={href}
                className="AffiliatLink inline-flex h-[42px] max-w-[122px] flex-col items-center justify-center rounded-[4px] border border-[#e9e7e7] bg-white px-3 hover:border-[#af3d36]"
              >
                <span className="text-[15px] leading-none font-extrabold tracking-tight text-[#111]">
                  amazon
                </span>
                <span className="mt-0.5 h-[2px] w-10 rounded-full bg-[#ff9900]" />
              </Link>
            )}
          </div>
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

    const rawButton = objectData.fields?.button as
      | { title?: string; link?: string }
      | Array<{ title?: string; link?: string }>
      | undefined;
    const buttonObj = Array.isArray(rawButton) ? rawButton[0] : rawButton;
    const instacartHref = buttonObj?.link || 'https://www.instacart.ca/store/recipes/27016451';

    return (
      <div className="SocialProduct flex flex-col p-0 md:px-[20px] md:pt-[10px] md:pb-[4px]">
        {/* Top 2-Column Recipe Hero (.SocialProduct__column-wrapper) */}
        <div className="SocialProduct__column SocialProduct__column-wrapper flex flex-col px-[16px] md:grid md:grid-cols-2 md:px-[20px]">
          {/* Left Column (.SocialProduct__row): max-w 600px, p 16px, right-aligned 500x500 slider */}
          <div className="SocialProduct__row min-h-fit p-0 md:max-w-[600px] md:p-[16px]">
            <div className="SocialProduct__carouselWrapper mb-[20px] flex justify-end">
              <div className="PicturesSlider w-full md:w-[500px]">
                <div>
                  <img
                    src={activeHeroImage}
                    alt={` ${displayName}. `}
                    className="PicturesSlider__previewImage mx-auto block h-auto max-h-[500px] min-h-[300px] w-full cursor-pointer object-contain md:h-[500px] md:w-[500px] md:object-cover"
                  />
                </div>
                <br />
                {galleryUrls.length > 0 ? (
                  <div className="ant-carousel mx-auto w-[345px] md:w-[457px]">
                    <div className="slick-track flex justify-center">
                      {galleryUrls.map((url, idx) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setSelectedGalleryUrl(url)}
                          className="inline-block border-0 bg-transparent p-0 outline-none"
                        >
                          <img
                            src={url}
                            alt={`${idx} ${displayName}`}
                            className={`PicturesSlider__thumbnail mr-[8px] h-[50px] w-[50px] cursor-pointer rounded-[4px] object-contain ${
                              activeHeroImage === url
                                ? 'PicturesSlider__thumbnail--active border border-[#af3d36]'
                                : 'border border-[#bcbcbc]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="SocialProduct__reward-wrap hidden h-0 w-[500px] md:ml-auto md:block">
              <div className="ProductRewardCard h-0 w-[500px]" />
            </div>
          </div>

          {/* Right Column (.SocialProduct__right-row): max-w 600px, p 16px 16px 16px 10px */}
          <div className="SocialProduct__row SocialProduct__right-row min-h-fit p-0 md:max-w-[600px] md:py-[16px] md:pr-[16px] md:pl-[10px]">
            <h1 className="SocialProduct__wobjName mt-[15px] mb-[8px] text-[26px] leading-[39px] font-semibold break-words text-black md:mt-0 md:mb-[15px]">
              <span>{displayName}</span>
            </h1>

            {username ? (
              <div className="SocialProduct__socialActions mb-[20px] flex items-center gap-2 md:mb-[15px]">
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
            ) : null}

            {actionStatus ? (
              <p className="mb-2 text-xs font-medium text-[#af3d36]">{actionStatus}</p>
            ) : null}

            <div className="SocialProduct__ratings mb-[15px] flex flex-wrap">
              <div className="SocialProduct__ratings-item mr-[30px]">
                <StarRatingDisplay stars={stars} label={ratingLabel} variant="social" />
              </div>
            </div>

            {/* Empty price spacer matching .SocialProduct__price (20px bottom margin) */}
            <div className="flex flex-row">
              <div className="SocialProduct__price mb-[20px] h-0 w-0" />
            </div>

            {/* Instacart Affiliate Button + Commission Notice */}
            <div className="mb-[5px] inline-flex w-[250px] flex-col">
              <div className="container h-[46px] w-[250px]">
                <a
                  href={instacartHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-acct AffiliatLink instacart mx-auto inline-flex h-[46px] min-w-[250px] cursor-pointer items-center justify-center gap-[8px] rounded-[24px] bg-[#003d29] px-[18px] py-[16px] text-[16px] leading-[24px] font-medium whitespace-nowrap text-[#faf1e5] no-underline hover:opacity-90"
                >
                  <img
                    className="instacart mr-[2px] h-[22px]"
                    src="https://hivecooking.com/images/Instacart-logo-carrot.svg"
                    alt="Instacart logo"
                  />
                  <span>Get Recipe Ingredients</span>
                </a>
              </div>
              <div className="mt-[8px] mb-[15px] h-[24px] w-[250px] text-center text-[16px] leading-[24px] font-normal text-[#a4adb8]">
                Earns commissions on purchases
              </div>
            </div>

            {/* Recipe Ingredients, Product IDs, Categories */}
            <div className="text-[16px] leading-[24px] text-[rgba(0,0,0,0.65)]">
              {ingredients.length > 0 ? (
                <div className="paddingBottom pb-[12px]">
                  <div className="CompanyId__title font-[550]">
                    <span>Recipe ingredients</span>:
                  </div>
                  <div>
                    <ul className="m-0 p-0">
                      {ingredients.map((ing, idx) => (
                        <li
                          key={idx}
                          className="field-website__title"
                          style={{ listStyle: 'inside' }}
                        >
                          <Link
                            href={`/discover-objects/recipe?search=${encodeURIComponent(ing)}`}
                            className="CompanyId__wordbreak-word break-words text-[#af3d36] hover:opacity-80"
                          >
                            <span itemProp="recipeIngredient">{ing}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {cookingTime ? (
                <div className="mb-[8px]">
                  <span className="CompanyId__title font-[550]">Cooking time: </span>
                  <span>{cookingTime}</span>
                </div>
              ) : null}

              {calories ? (
                <div className="mb-[8px]">
                  <span className="CompanyId__title font-[550]">Calories: </span>
                  <span>{calories}</span>
                </div>
              ) : null}

              <div className="mb-[8px]">
                <div className="CompanyId__container">
                  <button
                    type="button"
                    onClick={() => setShowProductIds((v) => !v)}
                    className="CompanyId__button CompanyId__title cursor-pointer border-0 bg-transparent p-0 font-[550] text-[rgba(0,0,0,0.65)]"
                  >
                    Product IDs:{' '}
                    <span className="CompanyId__websiteColor font-normal text-[#af3d36]">
                      {showProductIds ? '(hide)' : '(show)'}
                    </span>
                  </button>
                  {showProductIds ? (
                    <div className="CompanyId__block mt-[4px] font-mono text-[14px] text-[rgba(0,0,0,0.65)]">
                      {objectData.object_id}
                    </div>
                  ) : null}
                </div>
              </div>

              {categoryValues.length > 0 ? (
                <span className="Department__socialLayout paddingBottom flex flex-col pb-[12px] md:flex-row">
                  <span className="Department__wrapper">
                    <span>
                      <span className="Department__title mr-[4px] font-[550]">
                        <span>Categories</span>:{' '}
                      </span>
                      <span className="Department__container">
                        {categoryValues.map((cat) => (
                          <span key={cat} className="Department__block">
                            <Link
                              href={`/discover-objects/recipe?search=${encodeURIComponent(cat)}`}
                              className="Department__button text-[rgba(0,0,0,0.65)] hover:text-[#af3d36]"
                            >
                              <span className="Department__item ml-[4px]">{cat}</span>
                            </Link>
                          </span>
                        ))}
                      </span>
                    </span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Lower Column (.SocialProduct__column): Featured Post, Similar, User Reviews */}
        <div className="SocialProduct__column px-[16px] md:px-[20px]">
          {/* Centered "Top Recipe" Post Box (.SocialProduct__postWrapper) */}
          {featuredPostLoading ? (
            <div className="mx-auto my-[20px] h-96 w-full max-w-[900px] animate-pulse rounded-[4px] border border-[#e9e7e7] bg-white px-[20px] pt-[20px]" />
          ) : featuredPost ? (
            <div className="SocialProduct__postWrapper PageContent social mx-auto my-[20px] w-full max-w-[900px] rounded-[4px] border border-[#e9e7e7] bg-white px-[20px] pt-[20px] pb-0">
              <div className="RecipePost">
                <span className="StoryFull__title block text-center text-[28px] leading-[1.3em] font-bold text-[#353535] md:text-[34px]">
                  Top Recipe
                </span>

                <div>
                  <div className="StoryFull my-[12px]">
                    <span className="StoryFull__title block text-center text-[28px] leading-[1.3em] font-bold break-words text-[#353535] md:text-[34px]">
                      {featuredPost.title}
                    </span>

                    <div className="StoryFull__header relative flex py-[16px]">
                      <Link href={`/@${encodeURIComponent(featuredPost.author ?? '')}`}>
                        <div
                          className="Avatar h-[60px] w-[60px] min-w-[60px] rounded-full border border-[#e9e7e7] bg-cover bg-center bg-no-repeat"
                          title={featuredPost.author ?? ''}
                          style={{
                            backgroundImage: `url("${
                              featuredPost.authorProfile?.avatarUrl ||
                              `https://images.hive.blog/u/${featuredPost.author ?? 'hivecooking'}/avatar/small`
                            }")`,
                          }}
                        />
                      </Link>

                      <div className="StoryFull__header__text ml-[16px]">
                        <Link
                          href={`/@${encodeURIComponent(featuredPost.author ?? '')}`}
                          className="block text-[20px] leading-[30px]"
                        >
                          <span className="username font-medium text-black">
                            {featuredPost.author}
                          </span>
                          <span className="Weight ml-[8px]">
                            <span className="ant-tag inline-block rounded-[4px] border border-[#d9d9d9] bg-[#fafafa] px-[7px] text-[12px] leading-[20px] font-bold text-[rgba(0,0,0,0.65)]">
                              <span>
                                {featuredPost.authorProfile?.reputation &&
                                featuredPost.authorProfile.reputation > 0
                                  ? featuredPost.authorProfile.reputation
                                  : '788.98'}
                              </span>
                            </span>
                          </span>
                        </Link>

                        <span className="StoryFull__header__text__date text-[14px] text-[#99aab5]">
                          <span>{formatRelativeTime(featuredPost.createdAt)}</span>
                        </span>
                        <span className="StoryFull__posted_from text-[14px] text-[#99aab5]">
                          <span className="mx-[8px] text-[14px] text-[#99aab5]">•</span>
                          <span className="PostedFrom__text">Waivio</span>
                        </span>
                        <span className="text-[14px] text-[#99aab5]">
                          <span className="mx-[8px] text-[14px] text-[#99aab5]">•</span>
                          <span className="StoryFull__header__reading__time">
                            <span>{estimateReadingTime(featuredPost.body)} min read</span>
                          </span>
                        </span>
                      </div>

                      <i className="StoryFull__header__more iconfont icon-more absolute top-[36px] right-[8px] cursor-pointer pl-[20px] !text-[36px] !leading-[12px] text-[#f87007]" />
                    </div>

                    <div className="StoryFull__content">
                      {featuredPost.body ? <PostBodyRenderer body={featuredPost.body} /> : null}
                    </div>

                    {/* Linked Objects & Hashtags Accordion (.ant-collapse) */}
                    <div className="ant-collapse rounded-[4px] border border-[#d9d9d9] bg-[#fafafa]">
                      <div className="ant-collapse-item border-b border-[#d9d9d9]">
                        <button
                          type="button"
                          onClick={() => setLinkedObjectsOpen((v) => !v)}
                          className="ant-collapse-header flex w-full cursor-pointer items-center gap-2 px-[16px] py-[12px] text-left text-[16px] leading-[22px] text-[rgba(0,0,0,0.85)]"
                        >
                          <span className="text-[12px]">{linkedObjectsOpen ? '⌄' : '›'}</span>
                          <span>
                            Linked objects {(featuredPost.objects ?? [objectData]).length}
                          </span>
                        </button>
                        {linkedObjectsOpen ? (
                          <div className="ant-collapse-content border-t border-[#d9d9d9] bg-[#fafafa] py-3">
                            <div className="CardView mx-auto w-[97%] rounded-[4px] border border-[#e9e7e7] bg-white p-4 md:w-[80%]">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={activeHeroImage}
                                    alt={displayName}
                                    className="h-[80px] w-[80px] rounded-[4px] object-cover"
                                  />
                                  <div>
                                    <p className="text-[18px] font-semibold text-black">
                                      {displayName}
                                    </p>
                                    <StarRatingDisplay
                                      stars={stars}
                                      label={ratingLabel}
                                      variant="card"
                                    />
                                    <p className="text-[14px] text-[#99aab5]">
                                      Recipe
                                      {categoryValues[0] ? ` • ${categoryValues[0]}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={instacartHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-acct AffiliatLink instacart inline-flex h-[46px] min-w-[200px] items-center justify-center gap-[8px] rounded-[24px] bg-[#003d29] px-[18px] py-[16px] text-[16px] font-medium whitespace-nowrap text-[#faf1e5] hover:opacity-90"
                                >
                                  <img
                                    className="instacart mr-[2px] h-[22px]"
                                    src="https://hivecooking.com/images/Instacart-logo-carrot.svg"
                                    alt="Instacart logo"
                                  />
                                  <span>Get Ingredients</span>
                                </a>
                              </div>
                            </div>
                            <p className="mt-2 px-4 text-center text-[14px] text-[#99aab5]">
                              This post contains affiliate links. Commissions may be earned from
                              purchases made through these links at no extra cost to the buyer.
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="ant-collapse-item">
                        <button
                          type="button"
                          onClick={() => setHashtagsOpen((v) => !v)}
                          className="ant-collapse-header flex w-full cursor-pointer items-center gap-2 px-[16px] py-[12px] text-left text-[16px] leading-[22px] text-[rgba(0,0,0,0.85)]"
                        >
                          <span className="text-[12px]">{hashtagsOpen ? '⌄' : '›'}</span>
                          <span>Hashtags 9</span>
                        </button>
                      </div>
                    </div>

                    {/* StoryFooter: Payout, Vote/Comment/Reblog Buttons & Comments Header */}
                    <div className="StoryFooter pt-4">
                      <div className="StoryFooter__actions flex items-center justify-between border-b border-[#e9e7e7] pb-3 text-[16px] text-[#99aab5]">
                        <span className="Payout font-semibold text-[#af3d36]">
                          {featuredPost.reward?.label ?? '$ 3.54'}
                        </span>
                        <div className="Buttons flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() =>
                              featuredPost.author &&
                              void handleVotePost(featuredPost.author, featuredPost.permlink)
                            }
                            className="flex cursor-pointer items-center gap-1 text-[#99aab5] hover:text-[#af3d36]"
                          >
                            <i className="iconfont icon-praise_fill" />
                            <span>{featuredPost.votes?.totalCount ?? 0}</span>
                          </button>
                          <span className="flex items-center gap-1">
                            <i className="iconfont icon-message_fill" />
                            <span>{featuredPost.children ? featuredPost.children : ''}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="iconfont icon-share1" />
                            <span>3</span>
                          </span>
                          <i className="iconfont icon-more text-[20px] text-[#f87007]" />
                        </div>
                      </div>

                      <div className="Comments pt-4 pb-2">
                        <div className="Comments__header flex items-center justify-between">
                          <h2 className="text-[20px] font-bold text-[#353535]">
                            <span>Comments</span>
                          </h2>
                          <div className="SortSelector text-[16px] text-[#99aab5]">
                            <span>Sort by </span>
                            <span className="font-medium text-[#353535]">
                              Best <i className="iconfont icon-unfold text-xs" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <br />
            </div>
          ) : null}

          {/* SIMILAR Section (.SocialProduct__addOn-section) */}
          {similarObjects.length > 0 ? (
            <div className="SocialProduct__addOn-section mb-[30px]">
              <div className="SocialProduct__heading pb-[8px] text-[18px] leading-[27px] font-semibold text-black uppercase">
                Similar
              </div>
              <div className="Slider__wrapper-similar mb-[20px]">
                <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {similarObjects.map((sim) => (
                    <CatalogItemCard
                      key={sim.object_id}
                      item={sim}
                      href={`/object/${encodeURIComponent(sim.object_id)}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* USER REVIEWS Section (.SocialProductReviews__container) */}
          <div>
            <div className="SocialProductReviews__container mt-[40px] mb-[10px] flex justify-between">
              <div className="SocialProductReviews__heading pb-[8px] text-[18px] leading-[27px] font-semibold text-black uppercase">
                User reviews
              </div>
              <button
                type="button"
                className="SocialProductReviews__link mr-[20px] cursor-pointer border-0 bg-transparent pb-[8px] text-[18px] leading-[27px] font-semibold text-[#af3d36] uppercase"
              >
                Write review
              </button>
            </div>
            {posts.length > 0 ? (
              <div className="FeedMasonry flex flex-wrap gap-5 p-[20px]">
                {posts.map((post) => {
                  const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl ?? activeHeroImage;
                  const postHref = `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
                  return (
                    <article
                      key={`${post.author}/${post.permlink}`}
                      className="FeedMasonry__item flex w-[290px] flex-col justify-between overflow-hidden rounded-[16px] border border-[#e9e7e7] bg-white shadow-2xs"
                    >
                      <Link href={postHref} className="relative block">
                        <img
                          src={thumb}
                          alt={post.title ?? ''}
                          loading="lazy"
                          className="h-[162px] w-full object-cover hover:opacity-90"
                        />
                      </Link>
                      <div className="p-3">
                        <Link
                          href={postHref}
                          className="line-clamp-1 text-[16px] font-semibold text-black hover:text-[#af3d36]"
                        >
                          {post.title || post.permlink}
                        </Link>
                        <Link
                          href={`/@${encodeURIComponent(post.author)}`}
                          className="mt-1.5 flex items-center gap-2 text-[14px] text-[#99aab5]"
                        >
                          <img
                            src={`https://images.hive.blog/u/${post.author}/avatar/small`}
                            alt={post.author}
                            className="h-[25px] w-[25px] rounded-full object-cover"
                          />
                          <span>{post.author}</span>
                        </Link>
                        <div className="mt-2 flex items-center justify-between border-t border-[#e9e7e7] pt-2 text-[14px] text-[#99aab5]">
                          <span className="flex items-center gap-3">
                            <span>
                              <i className="iconfont icon-praise_fill mr-1" />
                              {post.votes?.totalCount ?? 0}
                            </span>
                            <span>
                              <i className="iconfont icon-share1 mr-1" />3
                            </span>
                          </span>
                          <span className="font-semibold text-[#af3d36]">
                            {post.reward?.label ?? '$0.00'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
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
