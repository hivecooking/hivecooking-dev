'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getHiveCustomJsonId, getRootObjectId } from '@/config/runtime';
import { useI18n } from '@/i18n';
import {
  fetchObjectPosts,
  fetchSinglePost,
  getObjectAvatarUrl,
  getObjectDescription,
  getObjectDisplayName,
  getObjectTitle,
  getSortedListItems,
  resolveObject,
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

function parseBreadcrumbs(raw: string | null): BreadcrumbEntry[] {
  if (!raw) return [];
  return raw
    .split('|')
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      return {
        id: decodeURIComponent(part.slice(0, idx)),
        name: decodeURIComponent(part.slice(idx + 1)),
      };
    })
    .filter((x): x is BreadcrumbEntry => x !== null && x.id.length > 0);
}

function serializeBreadcrumbs(entries: BreadcrumbEntry[]): string {
  return entries
    .slice(-6)
    .map((e) => `${encodeURIComponent(e.id)}:${encodeURIComponent(e.name)}`)
    .join('|');
}

const FALLBACK_FOOD_IMG =
  'https://waivio.nyc3.digitaloceanspaces.com/ab36044f80dd2351b19f3557fc4c2caa1a0e07965c620e648043adbdb4886180';

export function ObjectExplorer({ initialObjectId }: { initialObjectId?: string }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { username, broadcast } = useWallet();

  const rootId = getRootObjectId();
  const activeObjectId = initialObjectId ?? searchParams.get('id') ?? rootId;
  const rawPath = searchParams.get('path');
  const breadcrumbs = useMemo(() => parseBreadcrumbs(rawPath), [rawPath]);

  const [objectData, setObjectData] = useState<ProjectedObjectWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [featuredPost, setFeaturedPost] = useState<SinglePost | null>(null);
  const [featuredPostLoading, setFeaturedPostLoading] = useState(false);
  const [selectedPostKey, setSelectedPostKey] = useState<string | null>(null);

  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setDescExpanded(false);
      setPosts([]);
      setFeaturedPost(null);
      setSelectedPostKey(null);
      setActionStatus(null);

      const res = await resolveObject({ object_id: activeObjectId }, controller.signal);
      if (cancelled) return;
      setLoading(false);

      if (!isOk(res)) {
        setError(t('explore.error'));
        setObjectData(null);
        return;
      }

      const obj = res.value;
      setObjectData(obj);

      const listItems = getSortedListItems(obj);
      const shouldLoadPosts =
        obj.object_type === 'recipe' ||
        obj.object_type === 'newsfeed' ||
        obj.object_type === 'person' ||
        obj.object_type === 'business' ||
        (obj.object_type === 'list' && listItems.length === 0);

      if (shouldLoadPosts) {
        setPostsLoading(true);
        const postsRes = await fetchObjectPosts(
          obj.object_id,
          { limit: 12, currency: 'USD' },
          controller.signal,
        );
        if (cancelled) return;
        setPostsLoading(false);

        if (isOk(postsRes) && postsRes.value.items.length > 0) {
          const items = postsRes.value.items;
          setPosts(items);

          if (obj.object_type === 'recipe') {
            const first = items[0];
            setSelectedPostKey(`${first.author}/${first.permlink}`);
            setFeaturedPostLoading(true);
            const singleRes = await fetchSinglePost(
              first.author,
              first.permlink,
              'USD',
              controller.signal,
            );
            if (!cancelled) {
              setFeaturedPostLoading(false);
              if (isOk(singleRes)) {
                setFeaturedPost(singleRes.value);
              }
            }
          }
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeObjectId, t]);

  async function handleSelectPost(author: string, permlink: string) {
    const key = `${author}/${permlink}`;
    setSelectedPostKey(key);
    setFeaturedPostLoading(true);
    const res = await fetchSinglePost(author, permlink, 'USD');
    setFeaturedPostLoading(false);
    if (isOk(res)) {
      setFeaturedPost(res.value);
    }
  }

  const handleFollowObject = useCallback(async () => {
    if (!username || !objectData) {
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
    const all = getSortedListItems(objectData);
    if (objectData.object_id === '6nltas-recipes' && all.length > 1) {
      return all.filter((item) => item.object_id !== 'ugr-recipes-by-country');
    }
    return all;
  }, [objectData]);

  if (loading) {
    return (
      <div className="space-y-6 py-4">
        <div className="h-6 w-64 animate-pulse rounded-btn bg-secondary" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square animate-pulse rounded-card border border-border bg-secondary"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !objectData) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <p className="text-section text-error">{error ?? t('explore.error')}</p>
        <Link
          href="/object/6nltas-recipes"
          className="mt-4 inline-block rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg"
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
    ? [{ id: rootId, name: t('nav.byCountry') }]
    : [
        ...(breadcrumbs.length > 0
          ? breadcrumbs.filter((b) => b.id !== objectData.object_id)
          : [{ id: rootId, name: t('nav.byCountry') }]),
        { id: objectData.object_id, name: displayName },
      ];

  const serializedNextPath = serializeBreadcrumbs(nextBreadcrumbs);

  const ingredients = Array.isArray(objectData.fields?.ingredients)
    ? (objectData.fields.ingredients as unknown[]).map((x) => String(x))
    : Array.isArray(objectData.fields?.recipeIngredients)
      ? (objectData.fields.recipeIngredients as unknown[]).map((x) => String(x))
      : [];

  const categories = Array.isArray(objectData.fields?.category)
    ? (objectData.fields.category as unknown[]).map((x) => String(x))
    : [];

  const tagCategories = Array.isArray(objectData.fields?.tagCategory)
    ? (objectData.fields.tagCategory as unknown[]).map((x) => String(x))
    : [];

  const htmlContent =
    typeof objectData.fields?.htmlContent === 'string' ? objectData.fields.htmlContent : null;
  const pageContent =
    typeof objectData.fields?.pageContent === 'string' ? objectData.fields.pageContent : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation Trail */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-body-sm">
        {isRootList ? (
          <span className="font-semibold text-fg">{t('nav.byCountry')}</span>
        ) : (
          <>
            {(breadcrumbs.length > 0
              ? breadcrumbs
              : [{ id: rootId, name: t('nav.byCountry') }]
            ).map((crumb, idx, arr) => {
              const priorPath = serializeBreadcrumbs(arr.slice(0, idx));
              const href =
                crumb.id === rootId
                  ? '/object/6nltas-recipes'
                  : `/object/${encodeURIComponent(crumb.id)}${priorPath ? `?path=${encodeURIComponent(priorPath)}` : ''}`;
              return (
                <span key={`${crumb.id}-${idx}`} className="flex items-center gap-1.5">
                  <Link href={href} className="text-fg-secondary hover:text-accent hover:underline">
                    {crumb.name}
                  </Link>
                  <span className="text-fg-secondary">&gt;</span>
                </span>
              );
            })}
            <span className="font-semibold text-fg">{displayName}</span>
          </>
        )}
      </nav>

      {/* Object Header Card */}
      {!isRootList ? (
        <section className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-28 w-28 shrink-0 rounded-card border border-border object-cover sm:h-36 sm:w-36"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-block rounded-btn bg-accent px-2 py-0.5 text-xs font-semibold tracking-wider text-accent-fg uppercase">
                    {objectData.object_type}
                  </span>
                  <h1 className="mt-1 text-display text-fg">{displayName}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => void handleFollowObject()}
                  className="rounded-btn border border-accent px-3.5 py-1.5 text-body-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg"
                >
                  + {t('object.follow')}
                </button>
              </div>

              {subtitle ? (
                <p className="text-body font-medium text-fg-secondary">{subtitle}</p>
              ) : null}

              {description ? (
                <div className="text-body-sm leading-relaxed text-fg">
                  <p className={descExpanded ? 'whitespace-pre-line' : 'line-clamp-3 whitespace-pre-line'}>
                    {description}
                  </p>
                  {description.length > 260 ? (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 text-xs font-semibold text-accent hover:underline"
                    >
                      {descExpanded ? t('common.showLess') : t('common.readMore')}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {(categories.length > 0 || tagCategories.length > 0) ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-btn bg-surface-control px-2.5 py-1 text-xs font-medium text-fg"
                    >
                      🍴 {cat}
                    </span>
                  ))}
                  {tagCategories.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-btn border border-border px-2.5 py-1 text-xs text-fg-secondary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {actionStatus ? (
            <p className="mt-3 text-body-sm font-medium text-accent">{actionStatus}</p>
          ) : null}
        </section>
      ) : null}

      {/* Visual Tile Grid for Lists */}
      {sortedItems.length > 0 ? (
        <section>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sortedItems.map((item: ResolvedListItem) => {
              const itemName = getObjectDisplayName(item);
              const itemImg = getObjectAvatarUrl(item) ?? FALLBACK_FOOD_IMG;
              const itemDesc = getObjectDescription(item);
              const count = item.listItemsCount;
              const labelWithCount =
                typeof count === 'number' && count > 0 ? `${itemName} (${count})` : itemName;

              return (
                <Link
                  key={item.object_id}
                  href={`/object/${encodeURIComponent(item.object_id)}?path=${encodeURIComponent(serializedNextPath)}`}
                  className="group flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-control">
                    <img
                      src={itemImg}
                      alt={itemName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {item.object_type === 'recipe' ? (
                      <span className="absolute top-2 right-2 rounded-btn bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white uppercase">
                        Recipe
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-[42px] items-center justify-center bg-accent px-2.5 py-2 text-center text-body-sm font-semibold text-accent-fg">
                    <span className="line-clamp-2 leading-snug">{labelWithCount}</span>
                  </div>
                  {itemDesc && !isRootList && objectData.object_id !== '2atuhc-mediterranean-cuisine' ? (
                    <div className="border-t border-border bg-surface p-2.5 text-xs text-fg-secondary">
                      <p className="line-clamp-2">{itemDesc}</p>
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Recipe Ingredients + Featured Post View */}
      {objectData.object_type === 'recipe' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <aside className="space-y-4 lg:col-span-1">
            <div className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
              <h2 className="border-b border-border pb-2 text-section text-fg">
                🥗 {t('recipe.ingredients')}
              </h2>
              {ingredients.length > 0 ? (
                <ul className="mt-3 space-y-2 text-body-sm text-fg">
                  {ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-body-sm text-fg-secondary">{t('recipe.seePostIngredients')}</p>
              )}
            </div>

            {posts.length > 1 ? (
              <div className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
                <h3 className="text-body font-semibold text-fg">{t('recipe.relatedPosts')}</h3>
                <ul className="mt-3 space-y-2">
                  {posts.map((p) => {
                    const key = `${p.author}/${p.permlink}`;
                    const isSelected = selectedPostKey === key;
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => void handleSelectPost(p.author, p.permlink)}
                          className={`w-full rounded-btn border px-3 py-2 text-left text-body-sm transition-colors ${
                            isSelected
                              ? 'border-accent bg-surface-control font-semibold text-accent'
                              : 'border-border text-fg hover:border-accent'
                          }`}
                        >
                          <p className="line-clamp-1">{p.title || p.permlink}</p>
                          <p className="text-xs text-fg-secondary">
                            @{p.author} {p.reward?.label ? `· ${p.reward.label}` : ''}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="space-y-6 lg:col-span-2">
            {featuredPostLoading ? (
              <div className="h-96 animate-pulse rounded-card border border-border bg-surface p-6" />
            ) : featuredPost ? (
              <article className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-accent-fg">
                        {(featuredPost.author ?? 'H')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-body-sm font-semibold text-fg">
                        {featuredPost.authorProfile?.displayName || `@${featuredPost.author}`}
                      </p>
                      <p className="text-xs text-fg-secondary">
                        @{featuredPost.author}
                        {featuredPost.createdAt
                          ? ` · ${new Date(featuredPost.createdAt).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3">
                    {featuredPost.reward?.label ? (
                      <span className="rounded-btn bg-surface-control px-3 py-1 text-body-sm font-semibold text-fg">
                        {featuredPost.reward.label}
                      </span>
                    ) : null}
                    {featuredPost.author ? (
                      <button
                        type="button"
                        onClick={() =>
                          void handleVotePost(featuredPost.author!, featuredPost.permlink)
                        }
                        className="rounded-btn bg-accent px-3.5 py-1.5 text-body-sm font-semibold text-accent-fg hover:opacity-90"
                      >
                        ▲ {t('broadcast.vote')} ({featuredPost.votes?.totalCount ?? 0})
                      </button>
                    ) : null}
                  </div>
                </div>

                <h2 className="mt-5 text-section text-fg">
                  <Link
                    href={`/@${encodeURIComponent(featuredPost.author ?? '')}/${encodeURIComponent(featuredPost.permlink)}`}
                    className="hover:text-accent"
                  >
                    {featuredPost.title}
                  </Link>
                </h2>

                {featuredPost.videoEmbedUrl ? (
                  <div className="my-5 aspect-video w-full overflow-hidden rounded-card bg-black">
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
                  <div className="mt-4">
                    <PostBodyRenderer body={featuredPost.body} />
                  </div>
                ) : null}
              </article>
            ) : postsLoading ? (
              <div className="h-64 animate-pulse rounded-card border border-border bg-surface p-6" />
            ) : (
              <div className="rounded-card border border-border bg-surface p-6 text-body-sm text-fg-secondary">
                {t('recipe.noLinkedPosts')}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* HTML Object Content */}
      {htmlContent ? (
        <section className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
          <div
            className="prose max-w-none text-body text-fg"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </section>
      ) : null}

      {/* Page Object Content */}
      {pageContent ? (
        <section className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
          <PostBodyRenderer body={pageContent} />
        </section>
      ) : null}

      {/* Posts Feed for Newsfeed / Non-Recipe Objects */}
      {objectData.object_type !== 'recipe' && posts.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-section text-fg">{t('community.postsTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => {
              const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl;
              const postHref = `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
              return (
                <article
                  key={`${post.author}/${post.permlink}`}
                  className="flex flex-col justify-between rounded-card border border-border bg-surface p-card-padding shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-fg-secondary">
                      <Link
                        href={`/@${encodeURIComponent(post.author)}`}
                        className="font-semibold text-fg hover:text-accent"
                      >
                        @{post.author}
                      </Link>
                      <span>
                        {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    {thumb ? (
                      <Link href={postHref}>
                        <img
                          src={thumb}
                          alt={post.title ?? ''}
                          loading="lazy"
                          className="mt-3 h-48 w-full rounded-card object-cover hover:opacity-90"
                        />
                      </Link>
                    ) : null}
                    <h3 className="mt-3 text-body font-bold text-fg hover:text-accent">
                      <Link href={postHref}>{post.title || post.permlink}</Link>
                    </h3>
                    {post.excerpt ? (
                      <p className="mt-1.5 line-clamp-3 text-body-sm text-fg-secondary">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-body-sm font-semibold text-accent">
                      {post.reward?.label ?? '$0.00'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={postHref}
                        className="rounded-btn bg-secondary px-3 py-1 text-xs font-semibold text-secondary-fg hover:opacity-80"
                      >
                        {t('common.readMore')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleVotePost(post.author, post.permlink)}
                        className="rounded-btn bg-accent px-3 py-1 text-xs font-semibold text-accent-fg hover:opacity-90"
                      >
                        ▲ {post.votes?.totalCount ?? 0}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
