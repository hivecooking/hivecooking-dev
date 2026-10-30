'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useI18n } from '@/i18n';
import {
  fetchCurrencyMarket,
  fetchEngineWallet,
  fetchEngineWalletHistory,
  fetchHiveWallet,
  fetchSinglePost,
  fetchUserAccountSidebar,
  fetchUserActivity,
  fetchUserAuthorityGrantees,
  fetchUserAuthorityGrantors,
  fetchUserBlog,
  fetchUserBlogObjectFilters,
  fetchUserCategories,
  fetchUserComments,
  fetchUserExpertiseCounters,
  fetchUserExpertiseObjects,
  fetchUserFavorites,
  fetchUserFavoritesTypes,
  fetchUserFollowers,
  fetchUserFollowing,
  fetchUserFollowingObjects,
  fetchUserMentions,
  fetchUserProfile,
  fetchUserShopFilters,
  fetchUserShopObjects,
  fetchUserShopSections,
  fetchUserThreads,
  fetchWaivWallet,
  fetchWaivWalletHistory,
  getObjectAvatarUrl,
  getObjectDisplayName,
  type CurrencyMarketResponse,
  type EngineWalletResponse,
  type FeedPostItem,
  type HiveWalletResponse,
  type PaginatedUserFollowList,
  type ProjectedObjectWithCounts,
  type SinglePost,
  type UserAccountSidebar,
  type UserActivityResponse,
  type UserAuthorityListResponse,
  type UserCategoriesResponse,
  type UserExpertiseObjectsResponse,
  type UserFavoritesListResponse,
  type UserFollowingObjectsResponse,
  type UserProfile,
  type UserShopFiltersResponse,
  type UserShopObjectsResponse,
  type UserShopSectionsResponse,
  type WaivWalletResponse,
  type WalletHistoryResponse,
} from '@/modules/query-api';
import { buildHiveFollowOp, buildHiveUnfollowOp, buildVoteOp, useWallet } from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

import { PostBodyRenderer } from './post-body-renderer';

// --- Helpers & Icons ---

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return '';
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? 'a minute ago' : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? 'an hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return day === 1 ? 'a day ago' : `${day} days ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo === 1 ? 'a month ago' : `${mo} months ago`;
  const yr = Math.floor(day / 365);
  return yr === 1 ? 'a year ago' : `${yr} years ago`;
}

function formatManaPercent(val: number | null | undefined): string {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : 0;
  return `${n.toFixed(2)}%`;
}

function formatUsdValue(val: number | null | undefined, digits = 2): string {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : 0;
  return `$${n.toFixed(digits)}`;
}

function formatWebsiteLabel(url: string): { label: string; href: string } {
  const trimmed = url.trim();
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const label = trimmed.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
  return { label: label || trimmed, href };
}

function stripMarkdownExcerpt(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function SidebarIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex h-[20px] w-5 shrink-0 items-center justify-center text-[rgba(0,0,0,0.45)] [&_svg]:block"
      aria-hidden
    >
      {children}
    </span>
  );
}

const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const IconCircleStar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="12 6.5 13.7 10 17.5 10.5 14.7 13.2 15.4 17 12 15.2 8.6 17 9.3 13.2 6.5 10.5 10.3 10 12 6.5" />
  </svg>
);

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconDollar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconThumbUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);

const IconThumbDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);

const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconFilter = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const IconTrendingUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconWaivBadge = ({ size = 16 }: { size?: number }) => (
  <span
    style={{ width: size, height: size }}
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#f87007] font-bold text-white"
    aria-hidden
  >
    <span style={{ fontSize: Math.max(9, Math.floor(size * 0.58)), lineHeight: 1 }}>W</span>
  </span>
);

const IconHiveBadge = ({ size = 16 }: { size?: number }) => (
  <span
    style={{ width: size, height: size }}
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#e31337] font-bold text-white"
    aria-hidden
  >
    <span style={{ fontSize: Math.max(9, Math.floor(size * 0.58)), lineHeight: 1 }}>H</span>
  </span>
);

const IconHbdBadge = ({ size = 16 }: { size?: number }) => (
  <span
    style={{ width: size, height: size }}
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2b7a3d] font-bold text-white"
    aria-hidden
  >
    <span style={{ fontSize: Math.max(9, Math.floor(size * 0.58)), lineHeight: 1 }}>$</span>
  </span>
);

// --- Sub-navigation & Tab Resolution ---

type PrimarySectionKey =
  | 'feed'
  | 'map'
  | 'user-shop'
  | 'recipe'
  | 'favorites'
  | 'transfers'
  | 'followers'
  | 'expertise'
  | 'about';

type SubmenuVariant = 'feed' | 'wallet' | 'followers' | 'expertise' | null;

const FEED_SUBSEGMENTS = new Set(['threads', 'comments', 'mentions', 'activity']);

function getPrimarySection(rest: string[]): PrimarySectionKey {
  const head = rest[0] ?? '';
  if (!head || FEED_SUBSEGMENTS.has(head)) return 'feed';
  if (head === 'map') return 'map';
  if (head === 'user-shop') return 'user-shop';
  if (head === 'recipe') return 'recipe';
  if (head === 'favorites') return 'favorites';
  if (head === 'transfers' || head === 'permissions') return 'transfers';
  if (head === 'followers' || head === 'following' || head === 'following-objects') return 'followers';
  if (head === 'expertise-hashtags' || head === 'expertise-objects') return 'expertise';
  if (head === 'about') return 'about';
  return 'feed';
}

function getSubmenuVariant(rest: string[]): SubmenuVariant {
  const sec = getPrimarySection(rest);
  if (sec === 'feed') return 'feed';
  if (sec === 'transfers') return 'wallet';
  if (sec === 'followers') return 'followers';
  if (sec === 'expertise') return 'expertise';
  return null;
}

function profileTabClass(active: boolean): string {
  const base =
    '-mb-px inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-[16px] font-semibold transition-colors';
  if (active) {
    return `${base} border-[#af3d36] text-[#af3d36]`;
  }
  return `${base} border-transparent text-[rgba(0,0,0,0.45)] hover:text-[#333333]`;
}

// --- Profile Object Card (matches waiviodev ObjectCard in hivecooking theme) ---

function ProfileObjectCard({
  object: o,
  userWeight,
}: {
  object: ProjectedObjectWithCounts;
  userWeight?: number;
}) {
  const name = getObjectDisplayName(o);
  const avatar = getObjectAvatarUrl(o);
  const objType = (o.object_type ?? '').replace(/[_-]+/g, ' ');
  const desc =
    typeof o.fields?.description === 'string'
      ? o.fields.description
      : typeof o.fields?.title === 'string'
        ? o.fields.title
        : '';
  const price = typeof o.fields?.price === 'string' ? o.fields.price : '';
  const href = `/object/${encodeURIComponent(o.object_id)}`;

  return (
    <li className="relative list-none rounded-[8px] border border-[#e9e7e7] bg-[#f5f6f7]/40 p-3 sm:p-4">
      {userWeight != null ? (
        <div className="absolute right-3 top-3 rounded-[24px] border border-[#e9e7e7] bg-[#fafafa] px-2 py-0.5 font-mono text-[13px] text-[#333333]">
          {userWeight.toFixed(2)}
        </div>
      ) : null}
      <div className="flex flex-row items-start gap-3">
        <Link
          href={href}
          className="flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-[#fafafa] sm:h-[120px] sm:w-[120px]"
        >
          {avatar ? (
            <img src={avatar} alt={name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#af3d36]/10 text-2xl font-bold text-[#af3d36]">
              {name[0]?.toUpperCase() || 'O'}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className="line-clamp-2 text-[18px] font-semibold text-[#333333] hover:text-[#af3d36] hover:underline"
          >
            {name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[#99aab5]">
            {price ? (
              <>
                <span className="font-semibold text-[#333333]">{price}</span>
                {objType ? <span>·</span> : null}
              </>
            ) : null}
            {objType ? <span className="capitalize">{objType}</span> : null}
          </div>
          {desc ? (
            <p className="mt-2 line-clamp-3 text-[14px] leading-snug text-[rgba(0,0,0,0.84)]">
              {desc}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// --- Story Feed Card (matches waiviodev Story component in hivecooking theme) ---

function ProfileStoryCard({
  post,
  feedTab,
  onVote,
}: {
  post: FeedPostItem;
  feedTab?: string;
  onVote: (author: string, permlink: string) => void;
}) {
  const authorName = post.author;
  const displayAuthor = post.authorProfile?.displayName || authorName;
  const avatarUrl = post.authorProfile?.avatarUrl;
  const rep = post.authorProfile?.reputation;
  const timeIso = post.feedAt ?? post.createdAt;
  const relTime = formatRelativeTime(timeIso);
  const postHref = `/@${encodeURIComponent(authorName)}/${encodeURIComponent(post.permlink)}`;
  const authorHref = `/@${encodeURIComponent(authorName)}`;
  const thumb = post.thumbnailUrl ?? post.videoThumbnailUrl;
  const taggedObjects = (post.objects ?? []).slice(0, 4);
  const cleanExcerpt = stripMarkdownExcerpt(post.excerpt ?? post.body);

  return (
    <article className="min-w-0 rounded-[8px] border border-[#e9e7e7] bg-white/80 p-3 sm:p-4">
      <header className="flex min-w-0 items-start gap-2 sm:gap-3">
        <Link href={authorHref} className="shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayAuthor}
              className="h-10 w-10 rounded-full border border-[#e9e7e7] object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#af3d36] text-sm font-bold text-white">
              {authorName[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href={authorHref}
              className="truncate text-[14px] font-medium text-[#333333] hover:underline"
            >
              {displayAuthor}
            </Link>
            {rep != null ? (
              <span className="shrink-0 rounded border border-[#e9e7e7] bg-[#f5f6f7] px-1.5 py-0.5 font-mono text-[12px] text-[#99aab5] tabular-nums">
                {Number(rep).toFixed(2)}
              </span>
            ) : null}
          </div>
          {relTime ? (
            <div className="mt-0.5 text-[12px] text-[rgba(0,0,0,0.45)]">
              <time dateTime={timeIso ?? undefined}>{relTime}</time>
            </div>
          ) : null}
        </div>
        {taggedObjects.length > 0 ? (
          <ul className="flex shrink-0 items-start gap-1.5">
            {taggedObjects.map((o) => {
              const img = getObjectAvatarUrl(o);
              const label = getObjectDisplayName(o);
              return (
                <li key={o.object_id} className="list-none">
                  <Link
                    href={`/object/${encodeURIComponent(o.object_id)}`}
                    title={label}
                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-[#f5f6f7]"
                  >
                    {img ? (
                      <img src={img} alt={label} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-xs font-bold text-[#af3d36]">{label[0]?.toUpperCase()}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>

      <div className="mt-3 space-y-3">
        {post.title ? (
          <h2 className="line-clamp-2 text-[18px] font-semibold leading-snug text-[#333333]">
            {feedTab === 'comments' ? (
              <span className="mr-2 inline-flex items-center rounded bg-[#f5f6f7] px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-[#99aab5]">
                RE
              </span>
            ) : null}
            <Link href={postHref} className="hover:text-[#af3d36] hover:underline">
              {post.title}
            </Link>
          </h2>
        ) : null}

        {thumb ? (
          <Link href={postHref} className="block overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-[#f5f6f7]">
            <img
              src={thumb}
              alt={post.title ?? ''}
              className="block max-h-[420px] w-full object-cover"
              loading="lazy"
            />
          </Link>
        ) : null}

        {cleanExcerpt ? (
          <p className="line-clamp-4 text-[16px] leading-[1.45] text-[rgba(0,0,0,0.84)]">
            <Link href={postHref} className="hover:text-[rgba(0,0,0,0.84)]">
              {cleanExcerpt}
            </Link>
          </p>
        ) : null}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e9e7e7] pt-3">
        <div className="flex items-center gap-3 text-[14px] text-[#99aab5]">
          <button
            type="button"
            onClick={() => onVote(authorName, post.permlink)}
            className="inline-flex items-center gap-1.5 rounded-[24px] px-2 py-1 text-[#99aab5] hover:bg-[#f5f6f7] hover:text-[#af3d36]"
          >
            <IconThumbUp />
            {post.votes?.totalCount ? <span>{post.votes.totalCount}</span> : null}
          </button>
          <Link
            href={postHref}
            className="inline-flex items-center gap-1.5 rounded-[24px] px-2 py-1 text-[#99aab5] hover:bg-[#f5f6f7] hover:text-[#af3d36]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post.children ? <span>{post.children}</span> : null}
          </Link>
        </div>
        <span className="inline-flex items-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-2.5 py-0.5 font-mono text-[13px] font-medium text-[#333333] tabular-nums">
          {post.reward?.label ?? '$0.00'}
        </span>
      </footer>
    </article>
  );
}

// --- Left Sidebar: Account Sidebar (`ProfileAccountSidebar` parity) ---

function ProfileAccountSidebarView({
  sidebar,
}: {
  accountName: string;
  sidebar: UserAccountSidebar | null;
}) {
  const model: UserAccountSidebar = sidebar ?? {
    about: '',
    location: null,
    website: null,
    email: null,
    joinedAt: null,
    expertiseWeight: 0,
    lastActivityAt: null,
    totalVoteValueUsd: 0,
    socialLinks: [],
    cryptoWallets: [],
    waiv: { upvotingManaPercent: 0, downvotingManaPercent: 0, voteValueUsd: 0 },
    hive: {
      reputation: 25,
      upvotingManaPercent: 0,
      downvotingManaPercent: 0,
      resourceCreditsPercent: 0,
      voteValueUsd: 0,
    },
  };

  const website = model.website ? formatWebsiteLabel(model.website) : null;
  const joinedDate = model.joinedAt
    ? new Date(model.joinedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  const activeRel = model.lastActivityAt ? formatRelativeTime(model.lastActivityAt) : null;

  return (
    <aside
      className="sticky top-[73px] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-[8px] bg-[#fafafa] p-4 text-[14px] text-[rgba(0,0,0,0.84)]"
      aria-label="Account summary"
    >
      <div className="min-w-0 break-words">
        {model.about.trim().length > 0 ? (
          <p className="text-[16px] text-[rgba(0,0,0,0.84)]">{model.about}</p>
        ) : null}

        <div className={model.about.trim().length > 0 ? 'mt-4 space-y-2' : 'space-y-2'}>
          {model.location ? (
            <div className="flex min-w-0 items-start gap-2">
              <SidebarIcon>
                <IconMapPin />
              </SidebarIcon>
              <div className="min-w-0 flex-1">{model.location}</div>
            </div>
          ) : null}

          {website?.href ? (
            <div className="flex min-w-0 items-start gap-2">
              <SidebarIcon>
                <IconLink />
              </SidebarIcon>
              <div className="min-w-0 flex-1">
                <a
                  href={website.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#af3d36] hover:underline"
                >
                  {website.label}
                </a>
              </div>
            </div>
          ) : null}

          {model.email ? (
            <div className="flex min-w-0 items-start gap-2">
              <SidebarIcon>
                <IconMail />
              </SidebarIcon>
              <div className="min-w-0 flex-1">
                <a href={`mailto:${model.email}`} className="text-[#af3d36] hover:underline">
                  {model.email}
                </a>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {joinedDate ? (
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconCalendar />
                </SidebarIcon>
                <div className="min-w-0 flex-1">Joined {joinedDate}</div>
              </div>
            ) : null}

            <div className="flex min-w-0 items-start gap-2">
              <SidebarIcon>
                <IconCircleStar />
              </SidebarIcon>
              <div className="min-w-0 flex-1">Expertise: {model.expertiseWeight.toFixed(2)}</div>
            </div>

            {activeRel ? (
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconClock />
                </SidebarIcon>
                <div className="min-w-0 flex-1">Active: {activeRel}</div>
              </div>
            ) : null}

            <div className="flex min-w-0 items-start gap-2">
              <SidebarIcon>
                <IconDollar />
              </SidebarIcon>
              <div className="min-w-0 flex-1">
                Vote Value: {formatUsdValue(model.totalVoteValueUsd, 2)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {model.socialLinks.map((row) => (
              <a
                key={`${row.type}-${row.href}`}
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-start gap-2 rounded-[24px] text-left text-[14px] font-medium text-[#af3d36] hover:opacity-80 hover:underline"
              >
                <SidebarIcon>
                  <IconLink />
                </SidebarIcon>
                <span className="min-w-0 flex-1">{row.value || row.type}</span>
              </a>
            ))}

            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-[24px] text-left text-[14px] font-medium text-[#af3d36] hover:opacity-80 hover:underline"
            >
              <SidebarIcon>
                <IconWaivBadge size={16} />
              </SidebarIcon>
              <span className="min-w-0 flex-1">WAIV</span>
            </button>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-[24px] text-left text-[14px] font-medium text-[#af3d36] hover:opacity-80 hover:underline"
            >
              <SidebarIcon>
                <IconHiveBadge size={16} />
              </SidebarIcon>
              <span className="min-w-0 flex-1">HIVE</span>
            </button>
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-[24px] text-left text-[14px] font-medium text-[#af3d36] hover:opacity-80 hover:underline"
            >
              <SidebarIcon>
                <IconHbdBadge size={16} />
              </SidebarIcon>
              <span className="min-w-0 flex-1">HBD</span>
            </button>
          </div>

          <div className="mt-5">
            <h4 className="text-[16px] font-semibold text-[rgba(0,0,0,0.84)]">WAIV token</h4>
            <div className="mt-2 space-y-2">
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconThumbUp />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Upvoting mana: {formatManaPercent(model.waiv.upvotingManaPercent)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconThumbDown />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Downvoting mana: {formatManaPercent(model.waiv.downvotingManaPercent)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconDollar />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  WAIV vote: {formatUsdValue(model.waiv.voteValueUsd, 2)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="text-[16px] font-semibold text-[rgba(0,0,0,0.84)]">HIVE token</h4>
            <div className="mt-2 space-y-2">
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconCircleStar />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Hive reputation: {model.hive.reputation.toFixed(2)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconThumbUp />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Upvoting mana: {formatManaPercent(model.hive.upvotingManaPercent)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconThumbDown />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Downvoting mana: {formatManaPercent(model.hive.downvotingManaPercent)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconZap />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  Resource credits: {formatManaPercent(model.hive.resourceCreditsPercent)}
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-2">
                <SidebarIcon>
                  <IconDollar />
                </SidebarIcon>
                <div className="min-w-0 flex-1">
                  HIVE vote: {formatUsdValue(model.hive.voteValueUsd, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// --- Left Sidebar: Categories Nav (`CategoryNav` parity for Shop & Recipe) ---

function ProfileCategoryNav({
  accountName,
  sectionKey,
  lineage,
  categories,
}: {
  accountName: string;
  sectionKey: 'user-shop' | 'recipe';
  lineage: string[];
  categories: UserCategoriesResponse | null;
}) {
  const basePath = `/@${encodeURIComponent(accountName)}/${sectionKey}`;
  const upPath =
    lineage.length <= 1
      ? basePath
      : `${basePath}/${lineage.slice(0, -1).map(encodeURIComponent).join('/')}`;
  const prefix = lineage.length > 0 ? `${lineage.map(encodeURIComponent).join('/')}/` : '';

  return (
    <aside
      className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px] text-[#99aab5]"
      aria-label="Categories"
    >
      <p className="font-medium text-[#333333]">Categories</p>
      {lineage.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          <Link href={upPath} className="text-[#99aab5] hover:text-[#333333] hover:underline">
            ← Up
          </Link>
          <Link href={basePath} className="text-[#99aab5] hover:text-[#333333] hover:underline">
            All
          </Link>
        </p>
      ) : null}
      {!categories || categories.items.length === 0 ? (
        <p className="mt-2 text-[14px] text-[#99aab5]">No categories yet.</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {categories.items.map((item) => {
            const href = `${basePath}/${prefix}${encodeURIComponent(item.name)}`;
            const isActive = lineage.length > 0 && lineage[lineage.length - 1] === item.name;
            return (
              <li key={item.name}>
                <Link
                  href={href}
                  className={[
                    'flex items-center justify-between gap-2 rounded-[24px] px-2 py-1.5 text-[14px] transition-colors',
                    isActive
                      ? 'bg-white font-medium text-[#333333]'
                      : 'text-[#99aab5] hover:bg-white/80 hover:text-[#333333]',
                  ].join(' ')}
                >
                  <span className="truncate">{item.name}</span>
                  {item.has_children ? <span>›</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

// --- Left Sidebar: Favorites Type Nav (`FavoritesTypeNav` parity) ---

function ProfileFavoritesTypeNav({
  accountName,
  types,
  activeType,
}: {
  accountName: string;
  types: string[];
  activeType?: string;
}) {
  const basePath = `/@${encodeURIComponent(accountName)}/favorites`;
  const resolvedActive = activeType || types[0];

  return (
    <nav
      aria-label="Favorites"
      className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px]"
    >
      <p className="font-medium text-[#333333]">Favorites</p>
      {types.length === 0 ? (
        <p className="mt-2 text-[14px] text-[#99aab5]">No favorite types yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {types.map((type) => {
            const isActive = type === resolvedActive;
            return (
              <li key={type}>
                <Link
                  href={`${basePath}/${encodeURIComponent(type)}`}
                  className={[
                    'block rounded-[24px] px-2 py-1.5 text-[14px] capitalize transition-colors hover:bg-[#f5f6f7] hover:text-[#333333]',
                    isActive ? 'bg-[#f5f6f7] font-medium text-[#333333]' : 'text-[#99aab5]',
                  ].join(' ')}
                >
                  {type.replace(/[_-]+/g, ' ')}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

// --- Right Sidebars ---

function ProfilePostFiltersPanel({
  items,
  selectedIds,
  onToggle,
}: {
  items: { object_id: string; name: string; count: number }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <aside
      className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px]"
      aria-label="Filter posts"
    >
      <h2 className="flex items-center gap-2 font-medium text-[rgba(0,0,0,0.84)]">
        <span className="text-[#99aab5]">
          <IconFilter />
        </span>
        <span>Filter posts</span>
      </h2>
      {items.length > 0 ? (
        <ul className="mt-3 flex max-h-96 flex-col gap-1 overflow-y-auto">
          {items.map((item) => {
            const checked = selectedIds.includes(item.object_id);
            return (
              <li key={item.object_id}>
                <label className="flex cursor-pointer items-center gap-2 text-[#99aab5] hover:text-[#333333]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-[#e9e7e7] accent-[#af3d36]"
                    checked={checked}
                    onChange={() => onToggle(item.object_id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className="text-[12px] tabular-nums">({item.count})</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </aside>
  );
}

function ProfileShopFiltersPanel({
  filtersData,
  selectedRating,
  selectedTags,
  onToggleRating,
  onToggleTag,
}: {
  filtersData: UserShopFiltersResponse | null;
  selectedRating: number | null;
  selectedTags: string[];
  onToggleRating: (r: number) => void;
  onToggleTag: (tag: string) => void;
}) {
  const ratings = filtersData?.ratings ?? [10, 8, 6];
  const categories = filtersData?.categories ?? [];

  return (
    <aside
      className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px]"
      aria-label="Filters"
    >
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-[rgba(0,0,0,0.45)]">
        <span className="text-[#99aab5]">
          <IconFilter />
        </span>
        <span>Filters</span>
      </h2>

      {ratings.length > 0 ? (
        <section className="border-b border-[#e9e7e7] pb-3">
          <h3 className="mb-2 text-[14px] font-medium text-[#333333]">Ratings:</h3>
          <ul className="flex flex-col gap-1.5">
            {ratings.map((rate) => {
              const stars = Math.round(rate / 2);
              const checked = selectedRating === rate;
              return (
                <li key={rate}>
                  <label className="flex cursor-pointer items-center gap-2 text-[14px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-[#e9e7e7] accent-[#af3d36]"
                      checked={checked}
                      onChange={() => onToggleRating(rate)}
                    />
                    <span className="flex items-center gap-0.5 text-[#f5a623]">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx} className={idx < stars ? 'text-[#f5a623]' : 'text-[#e9e7e7]'}>
                          ★
                        </span>
                      ))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {categories.map((sec) =>
        sec.items.length > 0 ? (
          <section key={sec.category} className="mt-2 border-b border-[#e9e7e7] pb-2 last:border-b-0">
            <h3 className="py-1 text-[14px] font-medium text-[#333333]">{sec.category}:</h3>
            <ul className="flex flex-col gap-1">
              {sec.items.slice(0, 10).map((item) => {
                const encoded = `${sec.category}:${item.value}`;
                const checked = selectedTags.includes(encoded);
                return (
                  <li key={encoded}>
                    <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[#99aab5] hover:text-[#333333]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-[#e9e7e7] accent-[#af3d36]"
                        checked={checked}
                        onChange={() => onToggleTag(encoded)}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.value}</span>
                      <span className="text-[12px] tabular-nums">({item.count})</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
    </aside>
  );
}

const ACTIVITY_FILTER_SECTIONS = [
  {
    title: 'General',
    items: [
      { key: 'upvoted', label: 'Upvoted' },
      { key: 'downvoted', label: 'Downvoted' },
      { key: 'unvoted', label: 'Unvoted' },
      { key: 'followed', label: 'Followed' },
      { key: 'unfollowed', label: 'Unfollowed' },
      { key: 'replied', label: 'Replied' },
      { key: 'reblogged', label: 'Reblogged' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { key: 'powered_up', label: 'Powered up' },
      { key: 'received', label: 'Received' },
      { key: 'transfer', label: 'Transfer' },
      { key: 'savings', label: 'Savings' },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { key: 'author_reward', label: 'Author reward' },
      { key: 'curation_reward', label: 'Curation reward' },
      { key: 'claim_rewards', label: 'Claim rewards' },
    ],
  },
];

function ProfileActivityFiltersPanel({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <aside
      className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px]"
      aria-label="Activity filters"
    >
      <h2 className="text-[14px] font-semibold text-[#333333]">Activity filters</h2>
      {ACTIVITY_FILTER_SECTIONS.map((sec) => (
        <section key={sec.title} className="mt-4">
          <h3 className="text-[12px] font-medium uppercase tracking-wide text-[#99aab5]">
            {sec.title}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {sec.items.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-2 text-[14px] text-[rgba(0,0,0,0.84)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-[#e9e7e7] accent-[#af3d36]"
                    checked={selected.includes(item.key)}
                    onChange={() => onToggle(item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}

function ProfileCryptoMarketPanel({ market }: { market: CurrencyMarketResponse | null }) {
  const current = (market?.current ?? {}) as Record<
    string,
    { usd?: number; usd_24h_change?: number } | undefined
  >;
  const hive = current.hive;
  const hbd = current.hive_dollar;

  const rows = [
    { symbol: 'HIVE', price: hive?.usd ?? 0, change: hive?.usd_24h_change ?? 0 },
    { symbol: 'HBD', price: hbd?.usd ?? 0, change: hbd?.usd_24h_change ?? 0 },
  ];

  return (
    <aside className="sticky top-[73px] rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4 text-[14px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-semibold text-[#333333]">
          <span className="text-[#99aab5]">
            <IconTrendingUp />
          </span>
          <span>Market</span>
        </h2>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const isPos = r.change >= 0;
          return (
            <div key={r.symbol} className="border-t border-[#e9e7e7] pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-semibold text-[#333333]">{r.symbol}</span>
                <span className="font-mono text-[15px] font-semibold text-[#333333] tabular-nums">
                  ${r.price.toFixed(3)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-end">
                <span
                  className={[
                    'font-mono text-[12px] tabular-nums',
                    isPos ? 'text-[#2b7a3d]' : 'text-[#d9534f]',
                  ].join(' ')}
                >
                  {isPos ? '+' : ''}
                  {r.change.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// --- Activity Row Renderer (`ActivityRowContent` parity) ---

function formatActivityDescription(
  item: {
    id: string;
    timestamp: string;
    type: string;
    payload: Record<string, unknown>;
  },
  profileAccount: string,
): ReactNode {
  const p = item.payload;
  const profileLower = profileAccount.toLowerCase();

  switch (item.type) {
    case 'vote': {
      const voter = String(p.voter ?? '');
      const author = String(p.author ?? '');
      const permlink = String(p.permlink ?? '');
      const weight = Number(p.weight ?? 0);
      const pct = (Math.abs(weight) / 100).toFixed(2);
      const action = weight > 0 ? 'Upvoted' : weight < 0 ? 'Downvoted' : 'Unvoted';
      const isActor = voter.toLowerCase() === profileLower;
      return (
        <>
          {isActor ? (
            <span>
              {action} ({pct}%){' '}
            </span>
          ) : (
            <span>
              <Link href={`/@${encodeURIComponent(voter)}`} className="text-[#af3d36] hover:underline">
                @{voter}
              </Link>{' '}
              {action.toLowerCase()} ({pct}%){' '}
            </span>
          )}
          <Link
            href={`/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`}
            className="text-[#af3d36] hover:underline"
          >
            @{author}/{permlink}
          </Link>
        </>
      );
    }
    case 'comment': {
      const author = String(p.author ?? '');
      const permlink = String(p.permlink ?? '');
      const parentAuthor = String(p.parent_author ?? '');
      if (!parentAuthor) {
        return (
          <>
            Authored a post (
            <Link
              href={`/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`}
              className="text-[#af3d36] hover:underline"
            >
              {permlink}
            </Link>
            )
          </>
        );
      }
      return (
        <>
          Replied to{' '}
          <Link href={`/@${encodeURIComponent(parentAuthor)}`} className="text-[#af3d36] hover:underline">
            @{parentAuthor}
          </Link>{' '}
          (
          <Link
            href={`/@${encodeURIComponent(author)}/${encodeURIComponent(permlink)}`}
            className="text-[#af3d36] hover:underline"
          >
            {permlink}
          </Link>
          )
        </>
      );
    }
    case 'transfer': {
      const from = String(p.from ?? '');
      const to = String(p.to ?? '');
      const amount = String(p.amount ?? '');
      const memo = String(p.memo ?? '');
      const isIncoming = to.toLowerCase() === profileLower;
      return (
        <div>
          <span>
            {isIncoming ? 'Received' : 'Transferred'} <strong>{amount}</strong>{' '}
            {isIncoming ? 'from ' : 'to '}
            <Link
              href={`/@${encodeURIComponent(isIncoming ? from : to)}`}
              className="text-[#af3d36] hover:underline"
            >
              @{isIncoming ? from : to}
            </Link>
          </span>
          {memo ? <p className="mt-1 break-all text-[12px] text-[#99aab5]">{memo}</p> : null}
        </div>
      );
    }
    case 'claim_reward_balance': {
      const rHive = String(p.reward_hive ?? '');
      const rHbd = String(p.reward_hbd ?? '');
      const rVests = String(p.reward_vests ?? '');
      return (
        <span>
          Claimed rewards: {[rHive, rHbd, rVests].filter(Boolean).join(', ')}
        </span>
      );
    }
    case 'custom_json': {
      const id = String(p.id ?? '');
      return (
        <div>
          <span className="font-medium text-[#333333]">custom_json</span>
          {id ? <span className="ml-2 font-mono text-[12px] text-[#99aab5]">({id})</span> : null}
        </div>
      );
    }
    default:
      return <span className="font-medium text-[#333333]">{item.type.replace(/_/g, ' ')}</span>;
  }
}

// --- Wallet Views (`WaivWalletSummary`, `HiveWalletSummary`, `EngineWalletSummary`, `UserPermissionsList`) ---

function WalletBalanceRow({
  icon,
  title,
  subtitle,
  amount,
  suffix,
  borderBottom = true,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  amount: string;
  suffix?: string;
  borderBottom?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-4 py-4',
        borderBottom ? 'border-b border-[#e9e7e7]' : '',
      ].join(' ')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold text-[#333333]">{title}</p>
        {subtitle ? <p className="text-[14px] text-[#99aab5]">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <p className="font-mono text-[16px] font-semibold text-[#333333] tabular-nums">
          {amount} {suffix ? <span className="text-[14px] text-[#99aab5]">{suffix}</span> : null}
        </p>
      </div>
    </div>
  );
}

function WaivWalletView({
  wallet,
  history,
}: {
  accountName: string;
  wallet: WaivWalletResponse | null;
  history: WalletHistoryResponse | null;
}) {
  const display = (wallet?.display ?? {}) as Record<string, unknown>;
  const liquidWaiv = String(display.liquidWaiv ?? '0');
  const waivPower = String(display.waivPower ?? '0');
  const estUsd = String(display.estAccountValueUsd ?? '0.00');

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-white shadow-xs">
        <div className="flex items-start gap-4 border-b border-[#e9e7e7] bg-[#af3d36]/8 px-4 py-4">
          <div className="hidden h-10 w-10 shrink-0 sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#333333]">WAIV tokens</p>
            <p className="mt-0.5 text-[14px] text-[#99aab5]">
              Tokens earned through social engagement on Waivio and HiveCooking
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right">
            <p className="text-[13px] text-[#99aab5]">Est. Account Value</p>
            <p className="mt-0.5 font-mono text-[16px] font-semibold text-[#333333] tabular-nums">
              ${estUsd} USD
            </p>
          </div>
        </div>
        <div className="p-4">
          <WalletBalanceRow
            icon={<IconWaivBadge size={28} />}
            title="WAIV"
            subtitle="Liquid WAIV tokens"
            amount={liquidWaiv}
            suffix="WAIV"
          />
          <WalletBalanceRow
            icon={
              <span className="text-[#af3d36]">
                <IconZap />
              </span>
            }
            title="WAIV Power"
            subtitle="Staked WAIV tokens for voting"
            amount={waivPower}
            suffix="WP"
            borderBottom={false}
          />
        </div>
      </section>

      {history && history.items.length > 0 ? (
        <ul className="space-y-3">
          {history.items.map((item) => (
            <li
              key={item.id}
              className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4 text-[14px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[#333333]">
                  {item.kind.replace(/_/g, ' ') || item.operation}
                </span>
                <span className="text-[12px] text-[#99aab5]">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4 text-[14px] text-[#99aab5]">
          No WAIV transactions yet.
        </section>
      )}
    </div>
  );
}

function HiveWalletView({
  wallet,
  activity,
  accountName,
}: {
  accountName: string;
  wallet: HiveWalletResponse | null;
  activity: UserActivityResponse | null;
}) {
  const display = (wallet?.display ?? {}) as Record<string, unknown>;
  const liquidHive = String(display.liquidHive ?? '0.000');
  const hivePower = String(display.hivePower ?? '0.000');
  const rcMax = String(display.rcMax ?? '0');
  const hiveSavings = String(display.hiveSavings ?? '0.000');
  const hbdLiquid = String(display.hbdLiquid ?? '0.000');
  const hbdSavings = String(display.hbdSavings ?? '0.000');
  const estUsd = String(display.estAccountValueUsd ?? '0.00');

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-white shadow-xs">
        <div className="flex items-start gap-4 border-b border-[#e9e7e7] bg-[#d9534f]/8 px-4 py-4">
          <div className="hidden h-10 w-10 shrink-0 sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#333333]">HIVE tokens</p>
            <p className="mt-0.5 text-[14px] text-[#99aab5]">
              Native tokens of the Hive blockchain
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right">
            <p className="text-[13px] text-[#99aab5]">Est. Account Value</p>
            <p className="mt-0.5 font-mono text-[16px] font-semibold text-[#333333] tabular-nums">
              ${estUsd} USD
            </p>
          </div>
        </div>
        <div className="p-4">
          <WalletBalanceRow
            icon={<IconHiveBadge size={28} />}
            title="HIVE"
            subtitle="Liquid HIVE tokens"
            amount={liquidHive}
            suffix="HIVE"
          />
          <WalletBalanceRow
            icon={
              <span className="text-[#e31337]">
                <IconZap />
              </span>
            }
            title="HIVE Power"
            subtitle="Staked HIVE tokens"
            amount={hivePower}
            suffix="HP"
          />
          <WalletBalanceRow
            title="Resource Credits"
            subtitle="Maximum transaction capacity"
            amount={rcMax}
            suffix="b RC"
          />
          <WalletBalanceRow
            title="HIVE Savings"
            subtitle="3-day withdrawal waiting period"
            amount={hiveSavings}
            suffix="HIVE"
          />
          <WalletBalanceRow
            icon={<IconHbdBadge size={28} />}
            title="HBD"
            subtitle="Hive Backed Dollars"
            amount={hbdLiquid}
            suffix="HBD"
          />
          <WalletBalanceRow
            title="HBD Savings"
            subtitle="Earns APR interest on Hive"
            amount={hbdSavings}
            suffix="HBD"
            borderBottom={false}
          />
        </div>
      </section>

      {activity && activity.items.length > 0 ? (
        <ul className="space-y-3">
          {activity.items.map((item) => (
            <li
              key={item.id}
              className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4 text-[14px]"
            >
              <div className="text-[rgba(0,0,0,0.84)]">
                {formatActivityDescription(item, accountName)}
              </div>
              <p className="mt-1 text-[12px] text-[#99aab5]">
                {formatRelativeTime(item.timestamp)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4 text-[14px] text-[#99aab5]">
          No HIVE wallet transactions yet.
        </section>
      )}
    </div>
  );
}

function EngineWalletView({
  wallet,
}: {
  wallet: EngineWalletResponse | null;
}) {
  const combined = [...(wallet?.pinnedTokens ?? []), ...(wallet?.tokens ?? [])];
  const estUsd = (wallet?.estimatedAccountValueUsd ?? 0).toFixed(2);

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#e9e7e7] bg-white shadow-xs">
      <div className="flex items-start gap-4 border-b border-[#e9e7e7] bg-[#99aab5]/10 px-4 py-4">
        <div className="hidden h-10 w-10 shrink-0 sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-[#333333]">Hive Engine tokens</p>
          <p className="mt-0.5 text-[14px] text-[#99aab5]">
            Layer-2 smart contract tokens on Hive Engine
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end text-right">
          <p className="text-[13px] text-[#99aab5]">Est. Account Value</p>
          <p className="mt-0.5 font-mono text-[16px] font-semibold text-[#333333] tabular-nums">
            ${estUsd} USD
          </p>
        </div>
      </div>
      <div className="divide-y divide-[#e9e7e7] p-4">
        {combined.length === 0 ? (
          <p className="py-4 text-[14px] text-[#99aab5]">No Hive Engine tokens found.</p>
        ) : (
          combined.map((token) => (
            <div key={token.symbol} className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#e9e7e7] bg-[#fafafa]">
                {token.iconUrl ? (
                  <img src={token.iconUrl} alt={token.symbol} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-[#af3d36]">{token.symbol.slice(0, 3)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-[#333333]">{token.symbol}</p>
                <p className="text-[14px] text-[#99aab5]">{token.name}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <p className="font-mono text-[14px] text-[#99aab5] tabular-nums">{token.balance}</p>
                <p className="font-mono text-[16px] font-semibold text-[#333333] tabular-nums">
                  ${token.usdEstimate.toFixed(2)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PermissionsView({
  accountName,
  tab,
  onTabChange,
  list,
}: {
  accountName: string;
  tab: 'granted' | 'received';
  onTabChange: (t: 'granted' | 'received') => void;
  list: UserAuthorityListResponse | null;
}) {
  const items = list?.items ?? [];
  return (
    <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
      <div className="flex gap-4 border-b border-[#e9e7e7]">
        <button
          type="button"
          onClick={() => onTabChange('granted')}
          className={[
            'border-b-2 px-1 pb-3 text-[14px] transition-colors',
            tab === 'granted'
              ? 'border-[#af3d36] font-medium text-[#333333]'
              : 'border-transparent text-[#99aab5] hover:text-[#333333]',
          ].join(' ')}
        >
          Granted ({accountName})
        </button>
        <button
          type="button"
          onClick={() => onTabChange('received')}
          className={[
            'border-b-2 px-1 pb-3 text-[14px] transition-colors',
            tab === 'received'
              ? 'border-[#af3d36] font-medium text-[#333333]'
              : 'border-transparent text-[#99aab5] hover:text-[#333333]',
          ].join(' ')}
        >
          Received
        </button>
      </div>

      {tab === 'granted' ? (
        <div className="mt-4 space-y-2 rounded-[8px] border border-[#e9e7e7] bg-[#fafafa] p-4 text-[14px] text-[rgba(0,0,0,0.84)]">
          <p className="font-medium text-[#333333]">Posting & Active Authorizations</p>
          <p className="text-[#99aab5]">
            Accounts listed below have been granted authority on @{accountName}.
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        {items.length === 0 ? (
          <p className="text-[14px] text-[#99aab5]">No authorizations found.</p>
        ) : (
          <ul className="divide-y divide-[#e9e7e7]">
            {items.map((row, idx) => {
              const peer = row.accountName || row.grantee || row.grantor || '';
              return (
                <li key={`${peer}-${row.authorityType}-${idx}`} className="flex items-center gap-3 py-3">
                  <Link href={`/@${encodeURIComponent(peer)}`} className="shrink-0">
                    {row.avatarUrl ? (
                      <img
                        src={row.avatarUrl}
                        alt={peer}
                        className="h-11 w-11 rounded-full border border-[#e9e7e7] object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#af3d36] text-sm font-bold text-white">
                        {peer[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/@${encodeURIComponent(peer)}`}
                      className="font-medium text-[#333333] hover:underline"
                    >
                      {peer}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[#99aab5]">
                      <span className="rounded border border-[#e9e7e7] bg-[#f5f6f7] px-2 py-0.5 font-mono text-[13px] text-[#333333]">
                        {(row.wobjectsWeight ?? 0).toFixed(2)}
                      </span>
                      <span>·</span>
                      <span>{row.usersFollowingCount ?? 0}</span>
                      <span>·</span>
                      <span className="rounded bg-[#af3d36]/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#af3d36]">
                        {row.authorityType}
                      </span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// --- Main UserProfileViewer Component ---

export function UserProfileViewer({
  username,
  permlink,
  subpath = [],
}: {
  username: string;
  permlink?: string;
  subpath?: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { username: viewer, broadcast } = useWallet();

  // Core profile & sidebar state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sidebar, setSidebar] = useState<UserAccountSidebar | null>(null);
  const [followingObjectsTotal, setFollowingObjectsTotal] = useState(0);
  const [expertiseCounts, setExpertiseCounts] = useState({ hashtagsCount: 0, objectsCount: 0 });
  const [singlePost, setSinglePost] = useState<SinglePost | null>(null);
  const [loadingHero, setLoadingHero] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<string | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(false);

  // Tab-specific content state
  const [tabLoading, setTabLoading] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPostItem[]>([]);
  const [postFilterItems, setPostFilterItems] = useState<
    { object_id: string; name: string; count: number }[]
  >([]);
  const [selectedPostObjectIds, setSelectedPostObjectIds] = useState<string[]>([]);
  const [activityData, setActivityData] = useState<UserActivityResponse | null>(null);
  const [selectedActivityFilters, setSelectedActivityFilters] = useState<string[]>([]);

  const [categoriesData, setCategoriesData] = useState<UserCategoriesResponse | null>(null);
  const [shopFiltersData, setShopFiltersData] = useState<UserShopFiltersResponse | null>(null);
  const [shopSectionsData, setShopSectionsData] = useState<UserShopSectionsResponse | null>(null);
  const [shopObjectsData, setShopObjectsData] = useState<UserShopObjectsResponse | null>(null);
  const [selectedShopRating, setSelectedShopRating] = useState<number | null>(null);
  const [selectedShopTags, setSelectedShopTags] = useState<string[]>([]);

  const [favoriteTypes, setFavoriteTypes] = useState<string[]>([]);
  const [favoritesList, setFavoritesList] = useState<UserFavoritesListResponse | null>(null);

  const [waivWallet, setWaivWallet] = useState<WaivWalletResponse | null>(null);
  const [waivHistory, setWaivHistory] = useState<WalletHistoryResponse | null>(null);
  const [hiveWallet, setHiveWallet] = useState<HiveWalletResponse | null>(null);
  const [hiveWalletActivity, setHiveWalletActivity] = useState<UserActivityResponse | null>(null);
  const [engineWallet, setEngineWallet] = useState<EngineWalletResponse | null>(null);
  const [marketData, setMarketData] = useState<CurrencyMarketResponse | null>(null);
  const [permissionsTab, setPermissionsTab] = useState<'granted' | 'received'>('granted');
  const [authorityList, setAuthorityList] = useState<UserAuthorityListResponse | null>(null);

  const [socialUsersList, setSocialUsersList] = useState<PaginatedUserFollowList | null>(null);
  const [socialObjectsList, setSocialObjectsList] = useState<UserFollowingObjectsResponse | null>(
    null,
  );
  const [socialSort, setSocialSort] = useState<string>('recency');

  const [expertiseList, setExpertiseList] = useState<UserExpertiseObjectsResponse | null>(null);

  const primarySection = useMemo(() => getPrimarySection(subpath), [subpath]);
  const submenuVariant = useMemo(() => getSubmenuVariant(subpath), [subpath]);
  const headSegment = subpath[0] ?? '';
  const walletType = useMemo(() => {
    const raw = searchParams.get('type')?.toUpperCase();
    if (raw === 'HIVE' || raw === 'ENGINE') return raw;
    return 'WAIV';
  }, [searchParams]);

  // 1. Load Hero + Account Sidebar + Counts
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadBase() {
      setLoadingHero(true);
      setError(null);
      setVoteStatus(null);

      if (permlink) {
        const [postRes, profRes] = await Promise.all([
          fetchSinglePost(username, permlink, 'USD', controller.signal),
          fetchUserProfile(username, controller.signal),
        ]);
        if (cancelled) return;
        setLoadingHero(false);
        if (isOk(profRes)) {
          setProfile(profRes.value);
          setIsFollowingUser(profRes.value.is_following);
        }
        if (isOk(postRes)) {
          setSinglePost(postRes.value);
        } else {
          setError(t('explore.error'));
        }
        return;
      }

      const [profRes, sideRes, objCountRes, expCountRes] = await Promise.all([
        fetchUserProfile(username, controller.signal),
        fetchUserAccountSidebar(username, controller.signal),
        fetchUserFollowingObjects(username, { limit: 0 }, controller.signal),
        fetchUserExpertiseCounters(username, controller.signal),
      ]);

      if (cancelled) return;
      setLoadingHero(false);

      if (isOk(profRes)) {
        setProfile(profRes.value);
        setIsFollowingUser(profRes.value.is_following);
      } else {
        setError(t('explore.error'));
        return;
      }

      if (isOk(sideRes)) {
        setSidebar(sideRes.value);
      }
      if (isOk(objCountRes)) {
        setFollowingObjectsTotal(objCountRes.value.total);
      }
      if (isOk(expCountRes)) {
        setExpertiseCounts(expCountRes.value);
      }
    }

    void loadBase();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [username, permlink, t]);

  // 2. Load Tab Content when subpath or filters change
  useEffect(() => {
    if (permlink) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadTab() {
      setTabLoading(true);

      if (primarySection === 'feed') {
        if (headSegment === 'threads') {
          const res = await fetchUserThreads(username, { limit: 20 }, controller.signal);
          if (!cancelled) {
            setFeedPosts(isOk(res) ? res.value.items : []);
            setTabLoading(false);
          }
        } else if (headSegment === 'comments') {
          const res = await fetchUserComments(username, { limit: 20 }, controller.signal);
          if (!cancelled) {
            setFeedPosts(isOk(res) ? res.value.items : []);
            setTabLoading(false);
          }
        } else if (headSegment === 'mentions') {
          const res = await fetchUserMentions(username, { limit: 20 }, controller.signal);
          if (!cancelled) {
            setFeedPosts(isOk(res) ? res.value.items : []);
            setTabLoading(false);
          }
        } else if (headSegment === 'activity') {
          const res = await fetchUserActivity(
            username,
            { limit: 20, filters: selectedActivityFilters },
            controller.signal,
          );
          if (!cancelled) {
            setActivityData(isOk(res) ? res.value : null);
            setTabLoading(false);
          }
        } else {
          const [blogRes, filterRes] = await Promise.all([
            fetchUserBlog(
              username,
              {
                limit: 20,
                currency: 'USD',
                object_ids: selectedPostObjectIds.length > 0 ? selectedPostObjectIds : undefined,
              },
              controller.signal,
            ),
            fetchUserBlogObjectFilters(username, selectedPostObjectIds, controller.signal),
          ]);
          if (!cancelled) {
            setFeedPosts(isOk(blogRes) ? blogRes.value.items : []);
            setPostFilterItems(isOk(filterRes) ? filterRes.value.items : []);
            setTabLoading(false);
          }
        }
        return;
      }

      if (primarySection === 'map') {
        const typesRes = await fetchUserFavoritesTypes(username, controller.signal);
        if (!cancelled) {
          setFavoriteTypes(isOk(typesRes) ? typesRes.value.types : []);
          setTabLoading(false);
        }
        return;
      }

      if (primarySection === 'user-shop' || primarySection === 'recipe') {
        const types = primarySection === 'recipe' ? ['recipe'] : ['book', 'product'];
        const lineage = subpath.slice(1);
        const parentName = lineage.length > 0 ? lineage[lineage.length - 1] : undefined;
        const ancestorPath = lineage.length > 1 ? lineage.slice(0, -1) : undefined;

        const [catRes, filtRes] = await Promise.all([
          fetchUserCategories(
            username,
            { types, name: parentName, path: ancestorPath },
            controller.signal,
          ),
          fetchUserShopFilters(
            username,
            {
              types,
              categoryPath: lineage.length > 0 ? lineage : undefined,
              tags: selectedShopTags.length > 0 ? selectedShopTags : undefined,
              rating: selectedShopRating,
            },
            controller.signal,
          ),
        ]);

        if (cancelled) return;
        const cats = isOk(catRes) ? catRes.value : null;
        setCategoriesData(cats);
        setShopFiltersData(isOk(filtRes) ? filtRes.value : null);

        // If at root or has subcategories, fetch sections; otherwise fetch objects
        if (cats && cats.items.length > 0 && selectedShopTags.length === 0 && !selectedShopRating) {
          const secRes = await fetchUserShopSections(
            username,
            { types, name: parentName, path: ancestorPath },
            controller.signal,
          );
          if (!cancelled) {
            setShopSectionsData(isOk(secRes) ? secRes.value : null);
            setShopObjectsData(null);
            setTabLoading(false);
          }
        } else {
          const objRes = await fetchUserShopObjects(
            username,
            {
              types,
              categoryPath: lineage.length > 0 ? lineage : undefined,
              tags: selectedShopTags.length > 0 ? selectedShopTags : undefined,
              rating: selectedShopRating,
              limit: 20,
            },
            controller.signal,
          );
          if (!cancelled) {
            setShopObjectsData(isOk(objRes) ? objRes.value : null);
            setShopSectionsData(null);
            setTabLoading(false);
          }
        }
        return;
      }

      if (primarySection === 'favorites') {
        const typesRes = await fetchUserFavoritesTypes(username, controller.signal);
        if (cancelled) return;
        const types = isOk(typesRes) ? typesRes.value.types : [];
        setFavoriteTypes(types);
        const activeType = subpath[1] || types[0];
        if (activeType) {
          const listRes = await fetchUserFavorites(
            username,
            { objectType: activeType, limit: 20 },
            controller.signal,
          );
          if (!cancelled) {
            setFavoritesList(isOk(listRes) ? listRes.value : null);
            setTabLoading(false);
          }
        } else {
          setFavoritesList(null);
          setTabLoading(false);
        }
        return;
      }

      if (primarySection === 'transfers') {
        const mktPromise = fetchCurrencyMarket(controller.signal);
        if (headSegment === 'permissions') {
          const authPromise =
            permissionsTab === 'received'
              ? fetchUserAuthorityGrantors(username, { limit: 20 }, controller.signal)
              : fetchUserAuthorityGrantees(username, { limit: 20 }, controller.signal);
          const [mktRes, authRes] = await Promise.all([mktPromise, authPromise]);
          if (!cancelled) {
            if (isOk(mktRes)) setMarketData(mktRes.value);
            setAuthorityList(isOk(authRes) ? authRes.value : null);
            setTabLoading(false);
          }
        } else if (walletType === 'HIVE') {
          const [mktRes, hiveRes, actRes] = await Promise.all([
            mktPromise,
            fetchHiveWallet(username, controller.signal),
            fetchUserActivity(username, { limit: 20, filters: ['wallet'] }, controller.signal),
          ]);
          if (!cancelled) {
            if (isOk(mktRes)) setMarketData(mktRes.value);
            setHiveWallet(isOk(hiveRes) ? hiveRes.value : null);
            setHiveWalletActivity(isOk(actRes) ? actRes.value : null);
            setTabLoading(false);
          }
        } else if (walletType === 'ENGINE') {
          const [mktRes, engRes] = await Promise.all([
            mktPromise,
            fetchEngineWallet(username, controller.signal),
            fetchEngineWalletHistory(username, { limit: 20 }, controller.signal),
          ]);
          if (!cancelled) {
            if (isOk(mktRes)) setMarketData(mktRes.value);
            setEngineWallet(isOk(engRes) ? engRes.value : null);
            setTabLoading(false);
          }
        } else {
          const [mktRes, waivRes, histRes] = await Promise.all([
            mktPromise,
            fetchWaivWallet(username, controller.signal),
            fetchWaivWalletHistory(username, { limit: 20 }, controller.signal),
          ]);
          if (!cancelled) {
            if (isOk(mktRes)) setMarketData(mktRes.value);
            setWaivWallet(isOk(waivRes) ? waivRes.value : null);
            setWaivHistory(isOk(histRes) ? histRes.value : null);
            setTabLoading(false);
          }
        }
        return;
      }

      if (primarySection === 'followers') {
        if (headSegment === 'following') {
          const res = await fetchUserFollowing(
            username,
            { sort: socialSort, limit: 20 },
            controller.signal,
          );
          if (!cancelled) {
            setSocialUsersList(isOk(res) ? res.value : null);
            setTabLoading(false);
          }
        } else if (headSegment === 'following-objects') {
          const res = await fetchUserFollowingObjects(
            username,
            { sort: socialSort === 'recency' ? 'recency' : 'weight', limit: 20 },
            controller.signal,
          );
          if (!cancelled) {
            setSocialObjectsList(isOk(res) ? res.value : null);
            setTabLoading(false);
          }
        } else {
          const res = await fetchUserFollowers(
            username,
            { sort: socialSort, limit: 20 },
            controller.signal,
          );
          if (!cancelled) {
            setSocialUsersList(isOk(res) ? res.value : null);
            setTabLoading(false);
          }
        }
        return;
      }

      if (primarySection === 'expertise') {
        const scope = headSegment === 'expertise-objects' ? 'objects' : 'hashtags';
        const res = await fetchUserExpertiseObjects(
          username,
          { scope, limit: 30 },
          controller.signal,
        );
        if (!cancelled) {
          setExpertiseList(isOk(res) ? res.value : null);
          setTabLoading(false);
        }
        return;
      }

      setTabLoading(false);
    }

    void loadTab();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    username,
    permlink,
    primarySection,
    headSegment,
    subpath,
    walletType,
    permissionsTab,
    selectedPostObjectIds,
    selectedActivityFilters,
    selectedShopRating,
    selectedShopTags,
    socialSort,
  ]);

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

  const handleFollowToggle = useCallback(async () => {
    if (!viewer) {
      router.push('/?login=1');
      return;
    }
    try {
      const nextFollow = !isFollowingUser;
      setIsFollowingUser(nextFollow);
      const op = nextFollow
        ? buildHiveFollowOp(viewer, username)
        : buildHiveUnfollowOp(viewer, username);
      await broadcast([op]);
    } catch {
      setIsFollowingUser((prev) => !prev);
    }
  }, [broadcast, isFollowingUser, router, username, viewer]);

  // --- Standalone Single Post View (`/@username/permlink`) ---
  if (permlink) {
    if (loadingHero) {
      return (
        <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-6">
          <div className="h-36 animate-pulse rounded-[8px] border border-[#e9e7e7] bg-[#f5f6f7]" />
          <div className="h-64 animate-pulse rounded-[8px] border border-[#e9e7e7] bg-[#f5f6f7]" />
        </div>
      );
    }
    if (error || !singlePost) {
      return (
        <div className="mx-auto max-w-[1200px] px-6 py-8">
          <div className="rounded-[8px] border border-[#e9e7e7] bg-white p-8 text-center">
            <p className="text-[18px] font-semibold text-[#d9534f]">{error || t('explore.error')}</p>
            <Link
              href={`/@${encodeURIComponent(username)}`}
              className="mt-4 inline-block rounded-[24px] bg-[#af3d36] px-4 py-2 text-[14px] font-medium text-white"
            >
              @{username}
            </Link>
          </div>
        </div>
      );
    }

    const authorName = singlePost.author ?? singlePost.authorName ?? username;
    const linkedObjects = singlePost.objects ?? [];

    return (
      <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[14px]">
          <Link
            href={`/@${encodeURIComponent(authorName)}`}
            className="text-[#99aab5] hover:text-[#af3d36] hover:underline"
          >
            @{authorName}
          </Link>
          <span className="text-[#99aab5]">&gt;</span>
          <span className="line-clamp-1 font-semibold text-[#333333]">
            {singlePost.title || singlePost.permlink}
          </span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-[8px] border border-[#e9e7e7] bg-white p-4 shadow-xs lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e7e7] pb-4">
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
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#af3d36] font-bold text-white">
                    {authorName[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[16px] font-semibold text-[#333333]">
                    {singlePost.authorProfile?.displayName || profile?.displayName || `@${authorName}`}
                  </p>
                  <p className="text-[12px] text-[#99aab5]">
                    @{authorName}
                    {singlePost.createdAt
                      ? ` · ${new Date(singlePost.createdAt).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                {singlePost.reward?.label ? (
                  <span className="rounded-[24px] bg-[#f5f6f7] px-3 py-1 font-mono text-[14px] font-semibold text-[#333333]">
                    {singlePost.reward.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleVote(authorName, singlePost.permlink)}
                  className="rounded-[24px] bg-[#af3d36] px-3.5 py-1.5 text-[14px] font-semibold text-white hover:bg-[#93312b]"
                >
                  ▲ {t('broadcast.vote')} ({singlePost.votes?.totalCount ?? 0})
                </button>
              </div>
            </div>

            {voteStatus ? (
              <p className="mt-3 text-[14px] font-medium text-[#af3d36]">{voteStatus}</p>
            ) : null}

            <h1 className="mt-5 text-[24px] font-bold text-[#333333]">{singlePost.title}</h1>

            {singlePost.videoEmbedUrl ? (
              <div className="my-5 aspect-video w-full overflow-hidden rounded-[8px] bg-black">
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
              <div className="rounded-[8px] border border-[#e9e7e7] bg-white p-4 shadow-xs">
                <h2 className="border-b border-[#e9e7e7] pb-2 text-[16px] font-bold text-[#333333]">
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
                          className="flex items-center gap-3 rounded-[8px] border border-[#e9e7e7] p-2 hover:border-[#af3d36]"
                        >
                          {objImg ? (
                            <img
                              src={objImg}
                              alt={objName}
                              className="h-10 w-10 shrink-0 rounded-[6px] object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] bg-[#af3d36] text-xs font-bold text-white">
                              🍴
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-[#333333]">
                              {objName}
                            </p>
                            <p className="text-[12px] text-[#99aab5] uppercase">{obj.object_type}</p>
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

  // --- User Profile Shell (`waiviodev.com` organization in `hivecooking.com` theme) ---
  const base = `/@${encodeURIComponent(username)}`;
  const displayName = profile?.displayName || username;
  const hasCoverPhoto = Boolean(profile?.coverImageUrl);
  const hiveReputation = sidebar?.hive?.reputation ?? profile?.reputation ?? 25;
  const followerCount = profile?.followerCount ?? 0;
  const followingCount = profile?.followingCount ?? 0;
  const postingCount = profile?.postingCount ?? 0;
  const isSameUser =
    viewer != null && viewer.trim().toLowerCase() === username.trim().toLowerCase();

  const primaryTabs: {
    key: PrimarySectionKey;
    href: string;
    label: string;
    mobileOnly?: boolean;
  }[] = [
    { key: 'feed', href: base, label: 'Posts' },
    { key: 'map', href: `${base}/map`, label: 'Map' },
    { key: 'user-shop', href: `${base}/user-shop`, label: 'Shop' },
    { key: 'recipe', href: `${base}/recipe`, label: 'Recipe' },
    { key: 'favorites', href: `${base}/favorites`, label: 'Favorites' },
    { key: 'transfers', href: `${base}/transfers?type=WAIV`, label: 'Wallet' },
    { key: 'followers', href: `${base}/followers`, label: `Followers ${followerCount}` },
    { key: 'expertise', href: `${base}/expertise-hashtags`, label: 'Expertise' },
    { key: 'about', href: `${base}/about`, label: 'About', mobileOnly: true },
  ];

  return (
    <div className="w-full">
      {/* 1. Hero Header + Primary Horizontal Menu Band */}
      <header>
        <div className="relative w-full overflow-x-clip">
          <div
            className={[
              'overflow-hidden border-b border-[#e9e7e7]',
              hasCoverPhoto
                ? 'absolute inset-0 bg-white'
                : 'absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-[#af3d36]/30 to-white',
            ].join(' ')}
            aria-hidden={!hasCoverPhoto}
          >
            {hasCoverPhoto && profile?.coverImageUrl ? (
              <>
                <img
                  src={profile.coverImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent"
                  aria-hidden
                />
              </>
            ) : null}
          </div>

          <div
            className={[
              'mx-auto w-full max-w-[1200px] px-6',
              hasCoverPhoto
                ? 'relative z-10 flex min-h-[15rem] flex-col justify-end pt-8'
                : 'relative z-10 pt-36',
            ].join(' ')}
          >
            <div
              className={[
                'relative flex flex-col items-center gap-4 pb-4 text-center lg:flex-row lg:items-end lg:text-left',
                hasCoverPhoto ? '' : '-mt-12',
              ].join(' ')}
            >
              {/* Avatar (96x96 circle with 4px border) */}
              {loadingHero ? (
                <div className="flex h-24 w-24 shrink-0 self-center items-center justify-center rounded-full border-4 border-[#fafbfc] bg-[#fafbfc] shadow-[0_0_0_1px_#e6e6e6] lg:self-start" />
              ) : (
                <div className="shrink-0 self-center lg:self-start">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={displayName}
                      className="h-24 w-24 rounded-full border-4 border-[#fafbfc] bg-white object-cover shadow-[0_0_0_1px_#e6e6e6]"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#fafbfc] bg-[#af3d36] text-3xl font-bold text-white shadow-[0_0_0_1px_#e6e6e6]">
                      {username[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              )}

              {/* Center User Identity & Counts */}
              <div className="min-w-0 flex-1 pb-1">
                {loadingHero ? (
                  <div className="space-y-2">
                    <div className="mx-auto h-6 w-48 animate-pulse rounded-[24px] bg-white lg:mx-0" />
                    <div className="mx-auto h-4 w-72 animate-pulse rounded-[24px] bg-white lg:mx-0" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                      <h1
                        className={[
                          'truncate text-[22px] font-semibold leading-[1.35]',
                          hasCoverPhoto ? 'text-white drop-shadow-sm' : 'text-[rgba(0,0,0,0.84)]',
                        ].join(' ')}
                      >
                        {displayName}
                      </h1>
                      <span
                        title="Hive reputation"
                        className="rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-2 py-0.5 font-mono text-[14px] text-[rgba(0,0,0,0.84)] tabular-nums"
                      >
                        {Number(hiveReputation).toFixed(2)}
                      </span>
                      <span
                        className={[
                          'text-[14px]',
                          hasCoverPhoto ? 'text-white/85' : 'text-[#99aab5]',
                        ].join(' ')}
                      >
                        @{username}
                      </span>
                    </div>

                    <p
                      className={[
                        'mt-2 text-[13px]',
                        hasCoverPhoto ? 'text-white/85' : 'text-[#99aab5]',
                      ].join(' ')}
                    >
                      <span>{followerCount} Followers</span>
                      {' · '}
                      <span>{followingCount} Following</span>
                      {' · '}
                      <span>{postingCount} Posts</span>
                    </p>
                  </>
                )}
              </div>

              {/* Right Action Button (Follow / Edit profile) */}
              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end lg:pb-1">
                {!loadingHero && !isSameUser ? (
                  <button
                    type="button"
                    onClick={() => void handleFollowToggle()}
                    className={[
                      'rounded-[24px] px-4 py-2 text-[14px] font-medium transition-colors',
                      isFollowingUser
                        ? 'border border-[#e9e7e7] bg-white text-[#333333] hover:border-[#d9534f] hover:text-[#d9534f]'
                        : 'bg-[#af3d36] text-white hover:bg-[#93312b]',
                    ].join(' ')}
                  >
                    {isFollowingUser ? 'Following' : 'Follow'}
                  </button>
                ) : null}
                {!loadingHero && isSameUser ? (
                  <button
                    type="button"
                    className="rounded-[24px] border border-[#e9e7e7] bg-white px-4 py-2 text-[14px] font-medium text-[#333333] hover:bg-[#f5f6f7]"
                  >
                    Edit profile
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Full-bleed Primary Horizontal Menu Band */}
        <div className="w-full bg-white shadow-[0_0_0_1px_#e6e6e6]">
          <div className="mx-auto w-full max-w-[1200px] px-6 pt-0">
            <div className="grid grid-cols-1 lg:grid-cols-[224px_minmax(0,1fr)_224px]">
              <div className="min-w-0 lg:col-start-2">
                <div className="-mx-6 overflow-x-auto overflow-y-hidden px-6">
                  <nav
                    aria-label="Profile sections"
                    className="flex flex-nowrap items-end gap-x-2 border-b border-transparent"
                  >
                    {primaryTabs.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={[
                          profileTabClass(primarySection === item.key),
                          item.mobileOnly ? 'lg:hidden' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Profile Content Band (`bg-[#fafafa]`, 3-column grid on desktop, full width on Map) */}
      <div className="w-full bg-[#fafafa] pb-8">
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-0">
          {voteStatus ? (
            <p className="pt-3 text-[14px] font-medium text-[#af3d36]">{voteStatus}</p>
          ) : null}

          {primarySection === 'map' ? (
            <div className="mt-4">
              <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                <h2 className="text-[18px] font-semibold text-[#333333]">Map</h2>
                <p className="mt-2 text-[14px] text-[#99aab5]">
                  {favoriteTypes.length === 0
                    ? 'No map-eligible favorites yet.'
                    : 'No geo-located favorite items in this view.'}
                </p>
              </section>
            </div>
          ) : primarySection === 'about' ? (
            <div className="mt-4">
              <ProfileAccountSidebarView accountName={username} sidebar={sidebar} />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[224px_minmax(0,1fr)_224px]">
              {/* Left Sidebar (224px) */}
              <div className="hidden min-w-0 lg:block">
                {primarySection === 'user-shop' || primarySection === 'recipe' ? (
                  <ProfileCategoryNav
                    accountName={username}
                    sectionKey={primarySection}
                    lineage={subpath.slice(1)}
                    categories={categoriesData}
                  />
                ) : primarySection === 'favorites' ? (
                  <ProfileFavoritesTypeNav
                    accountName={username}
                    types={favoriteTypes}
                    activeType={subpath[1]}
                  />
                ) : (
                  <ProfileAccountSidebarView accountName={username} sidebar={sidebar} />
                )}
              </div>

              {/* Center Column (672px) */}
              <div className="min-h-[12rem] min-w-0">
                <div className="flex min-w-0 flex-col gap-4">
                  {/* Submenu Card */}
                  {submenuVariant ? (
                    <div className="rounded-[8px] border border-[#e9e7e7] bg-[#fafbfc] px-4 pt-2">
                      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4">
                        {submenuVariant === 'feed' ? (
                          <nav
                            aria-label="Feed sections"
                            className="flex flex-nowrap items-end gap-x-2 border-b border-[#e9e7e7]"
                          >
                            <Link href={base} className={profileTabClass(subpath.length === 0)}>
                              Posts
                            </Link>
                            <Link
                              href={`${base}/threads`}
                              className={profileTabClass(headSegment === 'threads')}
                            >
                              Threads
                            </Link>
                            <Link
                              href={`${base}/comments`}
                              className={profileTabClass(headSegment === 'comments')}
                            >
                              Comments
                            </Link>
                            <Link
                              href={`${base}/mentions`}
                              className={profileTabClass(headSegment === 'mentions')}
                            >
                              Mentions
                            </Link>
                            <Link
                              href={`${base}/activity`}
                              className={profileTabClass(headSegment === 'activity')}
                            >
                              Activity
                            </Link>
                          </nav>
                        ) : submenuVariant === 'wallet' ? (
                          <nav
                            aria-label="Wallet sections"
                            className="flex flex-nowrap items-end gap-x-2 border-b border-[#e9e7e7]"
                          >
                            <Link
                              href={`${base}/transfers?type=WAIV`}
                              className={profileTabClass(
                                headSegment !== 'permissions' && walletType === 'WAIV',
                              )}
                            >
                              WAIV
                            </Link>
                            <Link
                              href={`${base}/transfers?type=HIVE`}
                              className={profileTabClass(
                                headSegment !== 'permissions' && walletType === 'HIVE',
                              )}
                            >
                              HIVE
                            </Link>
                            <Link
                              href={`${base}/transfers?type=ENGINE`}
                              className={profileTabClass(
                                headSegment !== 'permissions' && walletType === 'ENGINE',
                              )}
                            >
                              Hive Engine
                            </Link>
                            <Link
                              href={`${base}/permissions`}
                              className={profileTabClass(headSegment === 'permissions')}
                            >
                              Authorizations
                            </Link>
                          </nav>
                        ) : submenuVariant === 'followers' ? (
                          <nav
                            aria-label="Followers sections"
                            className="flex flex-nowrap items-end gap-x-2 border-b border-[#e9e7e7]"
                          >
                            <Link
                              href={`${base}/followers`}
                              className={profileTabClass(headSegment === 'followers')}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>Followers</span>
                                <span className="text-[13px] text-[#99aab5]">{followerCount}</span>
                              </span>
                            </Link>
                            <Link
                              href={`${base}/following`}
                              className={profileTabClass(headSegment === 'following')}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>Following</span>
                                <span className="text-[13px] text-[#99aab5]">{followingCount}</span>
                              </span>
                            </Link>
                            <Link
                              href={`${base}/following-objects`}
                              className={profileTabClass(headSegment === 'following-objects')}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>Objects</span>
                                <span className="text-[13px] text-[#99aab5]">
                                  {followingObjectsTotal}
                                </span>
                              </span>
                            </Link>
                          </nav>
                        ) : submenuVariant === 'expertise' ? (
                          <nav
                            aria-label="Expertise sections"
                            className="flex flex-nowrap items-end gap-x-2 border-b border-[#e9e7e7]"
                          >
                            <Link
                              href={`${base}/expertise-hashtags`}
                              className={profileTabClass(headSegment === 'expertise-hashtags')}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>Hashtags</span>
                                <span className="text-[13px] text-[#99aab5]">
                                  {expertiseCounts.hashtagsCount}
                                </span>
                              </span>
                            </Link>
                            <Link
                              href={`${base}/expertise-objects`}
                              className={profileTabClass(headSegment === 'expertise-objects')}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span>Objects</span>
                                <span className="text-[13px] text-[#99aab5]">
                                  {expertiseCounts.objectsCount}
                                </span>
                              </span>
                            </Link>
                          </nav>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Main Center Content */}
                  {tabLoading ? (
                    <div className="space-y-3">
                      <div className="h-32 animate-pulse rounded-[8px] border border-[#e9e7e7] bg-white/80" />
                      <div className="h-32 animate-pulse rounded-[8px] border border-[#e9e7e7] bg-white/80" />
                    </div>
                  ) : primarySection === 'feed' ? (
                    headSegment === 'activity' ? (
                      activityData && activityData.items.length > 0 ? (
                        <ul className="flex flex-col gap-3">
                          {activityData.items.map((item) => (
                            <li key={item.id}>
                              <article className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                                <div className="min-w-0 break-words text-[14px] text-[rgba(0,0,0,0.84)]">
                                  {formatActivityDescription(item, username)}
                                </div>
                                <p className="mt-1 text-[13px] text-[#99aab5]">
                                  {formatRelativeTime(item.timestamp)}
                                </p>
                              </article>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                          <h2 className="text-[18px] font-semibold text-[rgba(0,0,0,0.84)]">
                            Activity
                          </h2>
                          <p className="mt-2 text-[14px] text-[#99aab5]">
                            No activity items to show yet.
                          </p>
                        </section>
                      )
                    ) : feedPosts.length === 0 ? (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <h2 className="text-[18px] font-semibold text-[rgba(0,0,0,0.84)]">Feed</h2>
                        <p className="mt-2 text-[14px] text-[#99aab5]">No items to show yet.</p>
                      </section>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {feedPosts.map((post) => (
                          <ProfileStoryCard
                            key={`${post.author}/${post.permlink}`}
                            post={post}
                            feedTab={headSegment || 'posts'}
                            onVote={(a, p) => void handleVote(a, p)}
                          />
                        ))}
                      </div>
                    )
                  ) : primarySection === 'user-shop' || primarySection === 'recipe' ? (
                    shopSectionsData && shopSectionsData.sections.length > 0 ? (
                      <div className="flex flex-col gap-6">
                        {shopSectionsData.sections.map((sec) => (
                          <section
                            key={sec.categoryName}
                            className="rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <h2 className="text-[18px] font-semibold text-[#333333]">
                                <Link
                                  href={`${pathname}/${encodeURIComponent(sec.categoryName)}`}
                                  className="hover:underline"
                                >
                                  {sec.categoryName}
                                </Link>
                              </h2>
                              <p className="text-[13px] text-[#99aab5] tabular-nums">
                                {sec.totalObjects} items
                              </p>
                            </div>
                            <ul className="mt-4 flex flex-col gap-4">
                              {sec.items.map((o) => (
                                <ProfileObjectCard key={o.object_id} object={o} />
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    ) : shopObjectsData && shopObjectsData.items.length > 0 ? (
                      <ul className="flex flex-col gap-4">
                        {shopObjectsData.items.map((o) => (
                          <ProfileObjectCard key={o.object_id} object={o} />
                        ))}
                      </ul>
                    ) : (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <h2 className="text-[18px] font-semibold text-[rgba(0,0,0,0.84)]">
                          {primarySection === 'recipe' ? 'Recipe' : 'Shop'}
                        </h2>
                        <p className="mt-2 text-[14px] text-[#99aab5]">No items in this section yet.</p>
                      </section>
                    )
                  ) : primarySection === 'favorites' ? (
                    favoritesList && favoritesList.items.length > 0 ? (
                      <ul className="flex flex-col gap-4">
                        {favoritesList.items.map((o) => (
                          <ProfileObjectCard key={o.object_id} object={o} />
                        ))}
                      </ul>
                    ) : (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <h2 className="text-[18px] font-semibold text-[rgba(0,0,0,0.84)]">
                          Favorites
                        </h2>
                        <p className="mt-2 text-[14px] text-[#99aab5]">No favorites yet.</p>
                      </section>
                    )
                  ) : primarySection === 'transfers' ? (
                    headSegment === 'permissions' ? (
                      <PermissionsView
                        accountName={username}
                        tab={permissionsTab}
                        onTabChange={setPermissionsTab}
                        list={authorityList}
                      />
                    ) : walletType === 'HIVE' ? (
                      <HiveWalletView
                        accountName={username}
                        wallet={hiveWallet}
                        activity={hiveWalletActivity}
                      />
                    ) : walletType === 'ENGINE' ? (
                      <EngineWalletView wallet={engineWallet} />
                    ) : (
                      <WaivWalletView
                        accountName={username}
                        wallet={waivWallet}
                        history={waivHistory}
                      />
                    )
                  ) : primarySection === 'followers' ? (
                    headSegment === 'following-objects' ? (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <div className="mb-4 flex items-center justify-end gap-2 text-[14px]">
                          <span className="text-[#99aab5]">Sort by:</span>
                          <select
                            value={socialSort === 'recency' ? 'recency' : 'weight'}
                            onChange={(e) => setSocialSort(e.target.value)}
                            className="rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-1 text-[14px] text-[#333333]"
                          >
                            <option value="weight">Rank</option>
                            <option value="recency">Recency</option>
                          </select>
                        </div>
                        {!socialObjectsList || socialObjectsList.items.length === 0 ? (
                          <p className="text-[14px] text-[#99aab5]">No followed objects yet.</p>
                        ) : (
                          <ul className="flex flex-col gap-3">
                            {socialObjectsList.items.map((o) => (
                              <ProfileObjectCard key={o.object_id} object={o} />
                            ))}
                          </ul>
                        )}
                      </section>
                    ) : (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <div className="mb-4 flex items-center justify-end gap-2 text-[14px]">
                          <span className="text-[#99aab5]">Sort by:</span>
                          <select
                            value={socialSort}
                            onChange={(e) => setSocialSort(e.target.value)}
                            className="rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-1 text-[14px] text-[#333333]"
                          >
                            <option value="recency">Recency</option>
                            <option value="rank">Rank</option>
                            <option value="followers">Followers</option>
                            <option value="a-z">A-Z</option>
                          </select>
                        </div>
                        {!socialUsersList || socialUsersList.items.length === 0 ? (
                          <p className="text-[14px] text-[#99aab5]">
                            {headSegment === 'following'
                              ? 'Not following anyone yet.'
                              : 'No followers yet.'}
                          </p>
                        ) : (
                          <ul className="divide-y divide-[#e9e7e7]">
                            {socialUsersList.items.map((row) => (
                              <li key={row.name} className="flex items-center gap-3 py-3">
                                <Link href={`/@${encodeURIComponent(row.name)}`} className="shrink-0">
                                  {row.avatarUrl ? (
                                    <img
                                      src={row.avatarUrl}
                                      alt={row.name}
                                      className="h-11 w-11 rounded-full border border-[#e9e7e7] object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#af3d36] text-sm font-bold text-white">
                                      {row.name[0]?.toUpperCase() || 'U'}
                                    </div>
                                  )}
                                </Link>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/@${encodeURIComponent(row.name)}`}
                                    className="font-medium text-[#333333] hover:underline"
                                  >
                                    {row.name}
                                  </Link>
                                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[#99aab5]">
                                    <span className="rounded border border-[#e9e7e7] bg-[#f5f6f7] px-2 py-0.5 font-mono text-[13px] text-[#333333]">
                                      {(row.wobjectsWeight ?? 0).toFixed(2)}
                                    </span>
                                    <span>·</span>
                                    <span>{row.usersFollowingCount ?? 0}</span>
                                  </p>
                                </div>
                                <Link
                                  href={`/@${encodeURIComponent(row.name)}`}
                                  className="shrink-0 rounded-[24px] border border-[#af3d36] px-3 py-1.5 text-[14px] font-medium text-[#af3d36] hover:bg-[#af3d36]/10"
                                >
                                  Follow
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    )
                  ) : primarySection === 'expertise' ? (
                    expertiseList && expertiseList.items.length > 0 ? (
                      <ul className="flex flex-col gap-4">
                        {expertiseList.items.map((o) => (
                          <ProfileObjectCard
                            key={o.object_id}
                            object={o}
                            userWeight={o.user_weight}
                          />
                        ))}
                      </ul>
                    ) : (
                      <section className="rounded-[8px] border border-[#e9e7e7] bg-white/80 p-4">
                        <h2 className="text-[18px] font-semibold text-[rgba(0,0,0,0.84)]">
                          Expertise
                        </h2>
                        <p className="mt-2 text-[14px] text-[#99aab5]">
                          Users start with zero expertise in hashtags and objects.
                        </p>
                      </section>
                    )
                  ) : null}
                </div>
              </div>

              {/* Right Sidebar (224px) */}
              <div className="hidden min-w-0 lg:block">
                {primarySection === 'feed' && subpath.length === 0 ? (
                  <ProfilePostFiltersPanel
                    items={postFilterItems}
                    selectedIds={selectedPostObjectIds}
                    onToggle={(id) =>
                      setSelectedPostObjectIds((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      )
                    }
                  />
                ) : primarySection === 'feed' && headSegment === 'activity' ? (
                  <ProfileActivityFiltersPanel
                    selected={selectedActivityFilters}
                    onToggle={(k) =>
                      setSelectedActivityFilters((prev) =>
                        prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
                      )
                    }
                  />
                ) : primarySection === 'user-shop' || primarySection === 'recipe' ? (
                  <ProfileShopFiltersPanel
                    filtersData={shopFiltersData}
                    selectedRating={selectedShopRating}
                    selectedTags={selectedShopTags}
                    onToggleRating={(r) =>
                      setSelectedShopRating((prev) => (prev === r ? null : r))
                    }
                    onToggleTag={(tag) =>
                      setSelectedShopTags((prev) =>
                        prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
                      )
                    }
                  />
                ) : primarySection === 'transfers' ? (
                  <ProfileCryptoMarketPanel market={marketData} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
