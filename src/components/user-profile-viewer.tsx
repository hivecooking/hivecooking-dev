'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@/i18n';
import {
  fetchSinglePost,
  fetchUserBlog,
  fetchUserProfile,
  getObjectAvatarUrl,
  getObjectDisplayName,
  type FeedPostItem,
  type SinglePost,
  type UserProfile,
} from '@/modules/query-api';
import { buildVoteOp, useWallet } from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

import { PostBodyRenderer } from './post-body-renderer';

export function UserProfileViewer({
  username,
  permlink,
}: {
  username: string;
  permlink?: string;
}) {
  const { t } = useI18n();
  const { username: viewer, broadcast } = useWallet();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [blogPosts, setBlogPosts] = useState<FeedPostItem[]>([]);
  const [singlePost, setSinglePost] = useState<SinglePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setVoteStatus(null);

      if (permlink) {
        const [postRes, profRes] = await Promise.all([
          fetchSinglePost(username, permlink, 'USD', controller.signal),
          fetchUserProfile(username, controller.signal),
        ]);
        if (cancelled) return;
        setLoading(false);
        if (isOk(profRes)) {
          setProfile(profRes.value);
        }
        if (isOk(postRes)) {
          setSinglePost(postRes.value);
        } else {
          setError(t('explore.error'));
        }
      } else {
        const [profRes, blogRes] = await Promise.all([
          fetchUserProfile(username, controller.signal),
          fetchUserBlog(username, { limit: 16, currency: 'USD' }, controller.signal),
        ]);
        if (cancelled) return;
        setLoading(false);
        if (!isOk(profRes)) {
          setError(t('explore.error'));
          return;
        }
        setProfile(profRes.value);
        if (isOk(blogRes)) {
          setBlogPosts(blogRes.value.items);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [username, permlink, t]);

  const handleVote = useCallback(
    async (author: string, postPermlink: string) => {
      if (!viewer) {
        setVoteStatus(t('broadcast.needConnect'));
        return;
      }
      try {
        setVoteStatus(t('wallet.connecting'));
        const op = buildVoteOp(viewer, author, postPermlink, 10000);
        await broadcast([op]);
        setVoteStatus(t('broadcast.success'));
      } catch (err) {
        setVoteStatus(err instanceof Error ? err.message : t('broadcast.error'));
      }
    },
    [broadcast, t, viewer],
  );

  if (loading) {
    return (
      <div className="space-y-6 py-4">
        <div className="h-36 animate-pulse rounded-card border border-border bg-secondary" />
        <div className="h-64 animate-pulse rounded-card border border-border bg-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <p className="text-section text-error">{error}</p>
        <Link
          href="/object/6nltas-recipes"
          className="mt-4 inline-block rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg"
        >
          {t('nav.byCountry')}
        </Link>
      </div>
    );
  }

  // Standalone Post View (/@username/permlink)
  if (permlink && singlePost) {
    const authorName = singlePost.author ?? singlePost.authorName ?? username;
    const linkedObjects = singlePost.objects ?? [];

    return (
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-body-sm">
          <Link href={`/@${encodeURIComponent(authorName)}`} className="text-fg-secondary hover:text-accent hover:underline">
            @{authorName}
          </Link>
          <span className="text-fg-secondary">&gt;</span>
          <span className="font-semibold text-fg line-clamp-1">
            {singlePost.title || singlePost.permlink}
          </span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-card border border-border bg-surface p-card-padding shadow-xs lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <Link
                href={`/@${encodeURIComponent(authorName)}`}
                className="flex items-center gap-3 hover:opacity-90"
              >
                {singlePost.authorProfile?.avatarUrl || profile?.avatarUrl ? (
                  <img
                    src={singlePost.authorProfile?.avatarUrl ?? profile?.avatarUrl ?? ''}
                    alt={authorName}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-bold text-accent-fg">
                    {authorName[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-body font-semibold text-fg">
                    {singlePost.authorProfile?.displayName || profile?.displayName || `@${authorName}`}
                  </p>
                  <p className="text-xs text-fg-secondary">
                    @{authorName}
                    {singlePost.createdAt
                      ? ` · ${new Date(singlePost.createdAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                {singlePost.reward?.label ? (
                  <span className="rounded-btn bg-surface-control px-3 py-1 text-body-sm font-semibold text-fg">
                    {singlePost.reward.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleVote(authorName, singlePost.permlink)}
                  className="rounded-btn bg-accent px-3.5 py-1.5 text-body-sm font-semibold text-accent-fg hover:opacity-90"
                >
                  ▲ {t('broadcast.vote')} ({singlePost.votes?.totalCount ?? 0})
                </button>
              </div>
            </div>

            {voteStatus ? (
              <p className="mt-3 text-body-sm font-medium text-accent">{voteStatus}</p>
            ) : null}

            <h1 className="mt-5 text-display text-fg">{singlePost.title}</h1>

            {singlePost.videoEmbedUrl ? (
              <div className="my-5 aspect-video w-full overflow-hidden rounded-card bg-black">
                <iframe
                  src={singlePost.videoEmbedUrl.replace('autoplay=1', 'autoplay=0')}
                  title={singlePost.title ?? 'Video'}
                  className="h-full w-full border-0"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : null}

            {singlePost.body ? (
              <div className="mt-4">
                <PostBodyRenderer body={singlePost.body} />
              </div>
            ) : null}
          </article>

          <aside className="space-y-4 lg:col-span-1">
            {linkedObjects.length > 0 ? (
              <div className="rounded-card border border-border bg-surface p-card-padding shadow-xs">
                <h2 className="border-b border-border pb-2 text-body font-bold text-fg">
                  Linked Objects
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {linkedObjects.map((obj) => {
                    const objName = getObjectDisplayName(obj);
                    const objImg = getObjectAvatarUrl(obj);
                    return (
                      <li key={obj.object_id}>
                        <Link
                          href={`/object/${encodeURIComponent(obj.object_id)}`}
                          className="flex items-center gap-3 rounded-btn border border-border p-2 hover:border-accent"
                        >
                          {objImg ? (
                            <img
                              src={objImg}
                              alt={objName}
                              className="h-10 w-10 shrink-0 rounded-btn object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent text-xs font-bold text-accent-fg">
                              🍴
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body-sm font-semibold text-fg">{objName}</p>
                            <p className="text-xs text-fg-secondary uppercase">{obj.object_type}</p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    );
  }

  // User Profile & Blog Feed View (/@username)
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-xs">
        {profile?.coverImageUrl ? (
          <img
            src={profile.coverImageUrl}
            alt=""
            className="h-36 w-full object-cover sm:h-48"
          />
        ) : (
          <div className="h-24 w-full bg-accent/15" />
        )}
        <div className="p-card-padding">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="-mt-12 h-24 w-24 shrink-0 rounded-full border-4 border-surface bg-surface object-cover shadow-md"
              />
            ) : (
              <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-surface bg-accent text-2xl font-bold text-accent-fg shadow-md">
                {username[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-display text-fg">{profile?.displayName || `@${username}`}</h1>
                {profile ? (
                  <span className="rounded-btn bg-surface-control px-2.5 py-0.5 text-xs font-semibold text-fg-secondary">
                    Rep {profile.reputation}
                  </span>
                ) : null}
              </div>
              <p className="text-body-sm text-fg-secondary">@{username}</p>
              {profile?.bio ? <p className="mt-2 text-body-sm text-fg">{profile.bio}</p> : null}
              {profile ? (
                <div className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-fg-secondary">
                  <span>
                    <strong className="text-fg">{profile.postingCount}</strong> Posts
                  </span>
                  <span>
                    <strong className="text-fg">{profile.followerCount}</strong> Followers
                  </span>
                  <span>
                    <strong className="text-fg">{profile.followingCount}</strong> Following
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {voteStatus ? (
        <p className="text-body-sm font-medium text-accent">{voteStatus}</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-section text-fg">Blog Posts</h2>
        {blogPosts.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-6 text-body-sm text-fg-secondary">
            {t('explore.noResults')}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {blogPosts.map((post) => {
              const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl;
              const postHref = `/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
              return (
                <article
                  key={`${post.author}/${post.permlink}`}
                  className="flex flex-col justify-between rounded-card border border-border bg-surface p-card-padding shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-fg-secondary">
                      <span className="font-semibold text-fg">@{post.author}</span>
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
                          className="mt-3 h-48 w-full rounded-card object-cover transition-opacity hover:opacity-90"
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
                        onClick={() => void handleVote(post.author, post.permlink)}
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
        )}
      </section>
    </div>
  );
}
