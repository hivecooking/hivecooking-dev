'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPostDiscussion,
  type DiscussionCommentItem,
  type PostDiscussionResponse,
} from '@/modules/query-api';
import {
  buildCommentOp,
  buildReblogOp,
  buildVoteOp,
  useWallet,
} from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

export function openLoginModal(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hivecooking:open-login'));
  }
}

export function renderSimpleMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(
    /```([\s\S]*?)```/g,
    '<pre class="my-2 overflow-x-auto rounded bg-[#f5f5f5] p-3 font-mono text-[13px]"><code>$1</code></pre>',
  );
  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-[13px] text-[#c7254e]">$1</code>',
  );
  // Images
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" class="my-2 max-h-[420px] max-w-full rounded object-contain" loading="lazy" />',
  );
  // Links
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#af3d36] underline hover:opacity-80">$1</a>',
  );
  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Headings
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="mt-3 mb-1 text-[16px] font-bold text-[#303540]">$1</h3>',
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="mt-4 mb-1.5 text-[18px] font-bold text-[#303540]">$1</h2>',
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="mt-4 mb-2 text-[20px] font-bold text-[#303540]">$1</h1>',
  );
  // Blockquotes
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<blockquote class="my-2 border-l-[3px] border-[#af3d36] pl-3 italic text-[#595959]">$1</blockquote>',
  );
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="mt-2">');
  html = html.replace(/\n/g, '<br />');
  return `<p>${html}</p>`;
}

function generateReplyPermlink(parentAuthor: string, parentPermlink: string): string {
  const cleanAuthor = parentAuthor.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const cleanPerm = parentPermlink
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32);
  const stamp = Date.now().toString(36);
  return `re-${cleanAuthor}-${cleanPerm}-${stamp}`;
}

export interface VoteButtonWithSliderProps {
  author: string;
  permlink: string;
  initialCount?: number;
  initialVoted?: boolean;
  compact?: boolean;
  onVoted?: (newWeight: number, deltaCount: number) => void;
}

export function VoteButtonWithSlider({
  author,
  permlink,
  initialCount = 0,
  initialVoted = false,
  compact = false,
  onVoted,
}: VoteButtonWithSliderProps) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVoted(initialVoted);
  }, [initialVoted]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    setError(null);
    setOpen((prev) => !prev);
  };

  const submitVote = async (weightPercent: number) => {
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const weight = Math.round(weightPercent * 100);
      const op = buildVoteOp(username, author, permlink, weight);
      await broadcast([op]);
      const nowVoted = weight > 0;
      const delta = nowVoted && !voted ? 1 : !nowVoted && voted ? -1 : 0;
      setVoted(nowVoted);
      setCount((c) => Math.max(0, c + delta));
      setOpen(false);
      onVoted?.(weight, delta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={popoverRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleTriggerClick}
        disabled={submitting}
        title={voted ? 'Voted (click to adjust or unvote)' : 'Upvote / Downvote with Hive Keychain'}
        className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
          voted
            ? 'bg-[#af3d36]/10 font-semibold text-[#af3d36]'
            : 'text-[#8c8c8c] hover:bg-[#f5f5f5] hover:text-[#af3d36]'
        } ${compact ? 'text-[12px]' : 'text-[13px]'}`}
      >
        <svg
          width={compact ? 13 : 15}
          height={compact ? 13 : 15}
          viewBox="0 0 24 24"
          fill={voted ? '#af3d36' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
        <span>{count}</span>
      </button>

      {open ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 z-50 mb-2 w-[260px] rounded-[6px] border border-[#e0e0e0] bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#303540]">
            <span>Vote Weight: {percent}%</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer text-[#8c8c8c] hover:text-[#303540]"
            >
              ✕
            </button>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="mb-2 w-full accent-[#af3d36]"
          />
          <div className="mb-2.5 flex justify-between gap-1">
            {[25, 50, 75, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPercent(preset)}
                className={`flex-1 cursor-pointer rounded border py-0.5 text-[11px] font-medium transition-colors ${
                  percent === preset
                    ? 'border-[#af3d36] bg-[#af3d36] text-white'
                    : 'border-[#e0e0e0] bg-[#fafafa] text-[#595959] hover:border-[#af3d36]'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitVote(percent)}
              className="flex-1 cursor-pointer rounded bg-[#af3d36] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#96322c] disabled:opacity-50"
            >
              {submitting ? 'Signing...' : `👍 Upvote (${percent}%)`}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitVote(-percent)}
              title="Downvote / Flag"
              className="cursor-pointer rounded border border-[#d9534f] px-2 py-1.5 text-[12px] font-semibold text-[#d9534f] hover:bg-[#fff5f5] disabled:opacity-50"
            >
              👎
            </button>
            {voted ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitVote(0)}
                title="Remove vote"
                className="cursor-pointer rounded border border-[#d9d9d9] px-2 py-1.5 text-[11px] text-[#595959] hover:bg-[#f5f5f5] disabled:opacity-50"
              >
                Unvote
              </button>
            ) : null}
          </div>
          {error ? <p className="mt-1.5 text-[11px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface ReblogButtonProps {
  author: string;
  permlink: string;
  initialReblogged?: boolean;
  compact?: boolean;
}

export function ReblogButton({
  author,
  permlink,
  initialReblogged = false,
  compact = false,
}: ReblogButtonProps) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [reblogged, setReblogged] = useState(initialReblogged);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReblogged(initialReblogged);
  }, [initialReblogged]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    if (reblogged) return;
    setConfirming((prev) => !prev);
  };

  const confirmReblog = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !username) return;
    setSubmitting(true);
    setError(null);
    try {
      const op = buildReblogOp(username, author, permlink);
      await broadcast([op]);
      setReblogged(true);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reblog failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting || reblogged}
        title={reblogged ? 'Reblogged to your blog' : 'Reblog this post'}
        className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
          reblogged
            ? 'font-semibold text-[#2e7d32]'
            : 'text-[#8c8c8c] hover:bg-[#f5f5f5] hover:text-[#af3d36]'
        } ${compact ? 'text-[12px]' : 'text-[13px]'}`}
      >
        <span>↻</span>
        <span>{reblogged ? 'Reblogged' : 'Reblog'}</span>
      </button>

      {confirming ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full left-0 z-50 mb-2 w-[230px] rounded-[6px] border border-[#e0e0e0] bg-white p-2.5 shadow-lg"
        >
          <p className="mb-2 text-[12px] text-[#303540]">
            Reblog <strong>@{author}</strong>&apos;s post to your blog? (This cannot be undone on Hive.)
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer rounded border border-[#d9d9d9] px-2 py-1 text-[11px] text-[#595959] hover:bg-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => void confirmReblog(e)}
              className="cursor-pointer rounded bg-[#af3d36] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#96322c] disabled:opacity-50"
            >
              {submitting ? 'Signing...' : 'Reblog Now'}
            </button>
          </div>
          {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface PostDiscussionSectionProps {
  author: string;
  permlink: string;
  initialOpen?: boolean;
}

export function PostDiscussionSection({
  author,
  permlink,
  initialOpen = true,
}: PostDiscussionSectionProps) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [discussion, setDiscussion] = useState<PostDiscussionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'BEST' | 'NEWEST' | 'OLDEST'>('BEST');

  // Root comment composer state
  const [rootBody, setRootBody] = useState('');
  const [rootSubmitting, setRootSubmitting] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [rootSuccess, setRootSuccess] = useState<string | null>(null);

  // Active reply state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const loadDiscussion = useCallback(async () => {
    if (!author || !permlink) return;
    setLoading(true);
    setError(null);
    const res = await fetchPostDiscussion(author, permlink);
    setLoading(false);
    if (isOk(res)) {
      setDiscussion(res.value);
    } else {
      setError('Failed to load comments');
    }
  }, [author, permlink]);

  useEffect(() => {
    if (initialOpen) {
      void loadDiscussion();
    }
  }, [initialOpen, loadDiscussion]);

  const handleRootSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    const trimmed = rootBody.trim();
    if (!trimmed) return;
    setRootSubmitting(true);
    setRootError(null);
    setRootSuccess(null);
    try {
      const commentPermlink = generateReplyPermlink(author, permlink);
      const op = buildCommentOp({
        parent_author: author,
        parent_permlink: permlink,
        author: username,
        permlink: commentPermlink,
        title: '',
        body: trimmed,
        json_metadata: JSON.stringify({
          app: 'hivecooking/1.0.0',
          format: 'markdown',
          tags: ['hivecooking', 'waivio'],
        }),
      });
      await broadcast([op]);
      const newId = `${username}/${commentPermlink}`;
      const newComment: DiscussionCommentItem = {
        id: newId,
        author: username,
        permlink: commentPermlink,
        parentAuthor: author,
        parentPermlink: permlink,
        rootAuthor: author,
        rootPermlink: permlink,
        depth: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        body: trimmed,
        netVotes: 0,
        children: 0,
        reward: { amount: 0, currency: 'USD', label: '$0.00', phase: 'pending' },
        votes: { totalCount: 0, previewVoters: [], voted: false },
        authorProfile: {
          name: username,
          displayName: username,
          avatarUrl: `https://images.hive.blog/u/${username}/avatar`,
          reputation: null,
        },
      };
      setDiscussion((prev) => {
        const base = prev ?? {
          rootAuthor: author,
          rootPermlink: permlink,
          rebloggedUsers: [],
          rebloggedByViewer: false,
          rootCommentIds: [],
          childrenById: {},
          comments: {},
        };
        return {
          ...base,
          rootCommentIds: [newId, ...base.rootCommentIds],
          comments: {
            ...base.comments,
            [newId]: newComment,
          },
        };
      });
      setRootBody('');
      setRootSuccess('Comment published to Hive!');
    } catch (err) {
      setRootError(err instanceof Error ? err.message : 'Failed to broadcast comment');
    } finally {
      setRootSubmitting(false);
    }
  };

  const handleReplySubmit = async (parentComment: DiscussionCommentItem) => {
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    setReplySubmitting(true);
    setReplyError(null);
    try {
      const commentPermlink = generateReplyPermlink(parentComment.author, parentComment.permlink);
      const op = buildCommentOp({
        parent_author: parentComment.author,
        parent_permlink: parentComment.permlink,
        author: username,
        permlink: commentPermlink,
        title: '',
        body: trimmed,
        json_metadata: JSON.stringify({
          app: 'hivecooking/1.0.0',
          format: 'markdown',
          tags: ['hivecooking', 'waivio'],
        }),
      });
      await broadcast([op]);
      const newId = `${username}/${commentPermlink}`;
      const newComment: DiscussionCommentItem = {
        id: newId,
        author: username,
        permlink: commentPermlink,
        parentAuthor: parentComment.author,
        parentPermlink: parentComment.permlink,
        rootAuthor: author,
        rootPermlink: permlink,
        depth: (parentComment.depth ?? 1) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        body: trimmed,
        netVotes: 0,
        children: 0,
        reward: { amount: 0, currency: 'USD', label: '$0.00', phase: 'pending' },
        votes: { totalCount: 0, previewVoters: [], voted: false },
        authorProfile: {
          name: username,
          displayName: username,
          avatarUrl: `https://images.hive.blog/u/${username}/avatar`,
          reputation: null,
        },
      };
      setDiscussion((prev) => {
        if (!prev) return prev;
        const existingChildren = prev.childrenById[parentComment.id] ?? [];
        return {
          ...prev,
          childrenById: {
            ...prev.childrenById,
            [parentComment.id]: [...existingChildren, newId],
          },
          comments: {
            ...prev.comments,
            [newId]: newComment,
          },
        };
      });
      setReplyBody('');
      setReplyingToId(null);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  const sortedRootIds = useMemo(() => {
    if (!discussion) return [];
    const ids = [...discussion.rootCommentIds];
    ids.sort((a, b) => {
      const ca = discussion.comments[a];
      const cb = discussion.comments[b];
      if (!ca || !cb) return 0;
      if (sort === 'NEWEST') {
        return new Date(cb.createdAt ?? 0).getTime() - new Date(ca.createdAt ?? 0).getTime();
      }
      if (sort === 'OLDEST') {
        return new Date(ca.createdAt ?? 0).getTime() - new Date(cb.createdAt ?? 0).getTime();
      }
      const ra = ca.reward?.amount ?? ca.netVotes ?? 0;
      const rb = cb.reward?.amount ?? cb.netVotes ?? 0;
      return rb - ra;
    });
    return ids;
  }, [discussion, sort]);

  const renderCommentNode = (commentId: string, depth = 0): React.ReactNode => {
    if (!discussion) return null;
    const item = discussion.comments[commentId];
    if (!item) return null;
    const childIds = discussion.childrenById[commentId] ?? [];
    const isReplying = replyingToId === commentId;

    return (
      <div
        key={commentId}
        className={`${depth > 0 ? 'mt-3 border-l-2 border-[#efefef] pl-3.5' : 'border-b border-[#efefef] py-3.5 last:border-b-0'}`}
      >
        <div className="flex items-start gap-2.5">
          <Link href={`/@${item.author}`} className="shrink-0">
            <img
              src={item.authorProfile?.avatarUrl || `https://images.hive.blog/u/${item.author}/avatar`}
              alt={item.author}
              className="h-8 w-8 rounded-full border border-[#e0e0e0] object-cover"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <Link
                href={`/@${item.author}`}
                className="font-semibold text-[#303540] hover:text-[#af3d36]"
              >
                {item.authorProfile?.displayName || `@${item.author}`}
              </Link>
              <span className="text-[12px] text-[#8c8c8c]">@{item.author}</span>
              {item.authorProfile?.reputation != null ? (
                <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5 text-[11px] font-medium text-[#595959]">
                  {Math.round(item.authorProfile.reputation)}
                </span>
              ) : null}
              {item.createdAt ? (
                <span className="text-[11px] text-[#99aab5]">
                  · {new Date(item.createdAt).toLocaleString()}
                </span>
              ) : null}
            </div>

            <div
              className="mt-1.5 text-[14px] leading-[1.55] break-words text-[#303540]"
              dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(item.body) }}
            />

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[#8c8c8c]">
              <VoteButtonWithSlider
                author={item.author}
                permlink={item.permlink}
                initialCount={item.votes?.totalCount ?? item.netVotes ?? 0}
                initialVoted={Boolean(item.votes?.voted)}
                compact
              />
              {item.reward?.label ? (
                <span className="font-medium text-[#595959]">{item.reward.label}</span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                    return;
                  }
                  setReplyingToId(isReplying ? null : commentId);
                  setReplyBody('');
                  setReplyError(null);
                }}
                className="cursor-pointer font-medium text-[#595959] hover:text-[#af3d36]"
              >
                {isReplying ? 'Cancel Reply' : 'Reply'}
              </button>
            </div>

            {isReplying ? (
              <div className="mt-2.5 rounded border border-[#e0e0e0] bg-[#fafafa] p-2.5">
                <textarea
                  rows={3}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Reply to @${item.author}...`}
                  className="w-full rounded border border-[#d9d9d9] bg-white p-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
                {replyError ? <p className="mt-1 text-[11px] text-red-600">{replyError}</p> : null}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReplyingToId(null)}
                    className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-2.5 py-1 text-[12px] text-[#595959] hover:bg-[#f5f5f5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={replySubmitting || !replyBody.trim()}
                    onClick={() => void handleReplySubmit(item)}
                    className="cursor-pointer rounded bg-[#af3d36] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#96322c] disabled:opacity-50"
                  >
                    {replySubmitting ? 'Posting...' : 'Post Reply'}
                  </button>
                </div>
              </div>
            ) : null}

            {childIds.length > 0 ? (
              <div className="mt-2">
                {childIds.map((cid) => renderCommentNode(cid, depth + 1))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const totalComments = discussion ? Object.keys(discussion.comments).length : 0;

  return (
    <div className="mt-5 border-t border-[#e8e8e8] pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[15px] font-bold text-[#303540]">
          Comments ({totalComments})
        </h4>
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="text-[#8c8c8c]">Sort:</span>
          {(['BEST', 'NEWEST', 'OLDEST'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSort(mode)}
              className={`cursor-pointer rounded px-2 py-0.5 font-medium ${
                sort === mode
                  ? 'bg-[#af3d36] text-white'
                  : 'bg-[#f5f5f5] text-[#595959] hover:text-[#af3d36]'
              }`}
            >
              {mode === 'BEST' ? 'Best' : mode === 'NEWEST' ? 'Newest' : 'Oldest'}
            </button>
          ))}
        </div>
      </div>

      {/* Root Comment Composer */}
      <form
        onSubmit={(e) => void handleRootSubmit(e)}
        className="mb-4 rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] p-3"
      >
        <textarea
          rows={3}
          value={rootBody}
          onChange={(e) => setRootBody(e.target.value)}
          placeholder={
            isAuthenticated
              ? `Write a comment as @${username}... (Markdown supported)`
              : 'Sign in with Hive Keychain to write a comment...'
          }
          className="w-full rounded border border-[#d9d9d9] bg-white p-2.5 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
        />
        {rootError ? <p className="mt-1.5 text-[12px] text-red-600">{rootError}</p> : null}
        {rootSuccess ? <p className="mt-1.5 text-[12px] text-[#2e7d32]">{rootSuccess}</p> : null}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-[#8c8c8c]">
            {isAuthenticated ? `Posting as @${username}` : 'Hive Keychain required to broadcast'}
          </span>
          {isAuthenticated ? (
            <button
              type="submit"
              disabled={rootSubmitting || !rootBody.trim()}
              className="cursor-pointer rounded bg-[#af3d36] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#96322c] disabled:opacity-50"
            >
              {rootSubmitting ? 'Broadcasting...' : 'Post Comment'}
            </button>
          ) : (
            <button
              type="button"
              onClick={openLoginModal}
              className="cursor-pointer rounded bg-[#af3d36] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#96322c]"
            >
              Sign in to Comment
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="py-4 text-center text-[13px] text-[#8c8c8c]">Loading discussion...</div>
      ) : error ? (
        <div className="py-3 text-[13px] text-red-600">{error}</div>
      ) : sortedRootIds.length === 0 ? (
        <div className="py-4 text-center text-[13px] text-[#8c8c8c]">
          No comments yet. Be the first to share your thoughts!
        </div>
      ) : (
        <div>{sortedRootIds.map((id) => renderCommentNode(id, 0))}</div>
      )}
    </div>
  );
}

export interface QuickThreadComposerProps {
  defaultHashtag?: string;
  objectId?: string;
  onPublished?: (post: { author: string; permlink: string; body: string }) => void;
}

export function QuickThreadComposer({
  defaultHashtag = 'hivecooking',
  objectId,
  onPublished,
}: QuickThreadComposerProps) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const permlink = `thread-${username.replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
      const tags = ['leothreads', defaultHashtag, 'waivio'].filter(Boolean);
      const finalBody =
        objectId && !trimmed.includes(objectId)
          ? `${trimmed}\n\n[#${objectId}](/object/${objectId})`
          : trimmed;
      const op = buildCommentOp({
        parent_author: '',
        parent_permlink: 'leothreads',
        author: username,
        permlink,
        title: '',
        body: finalBody,
        json_metadata: JSON.stringify({
          app: 'hivecooking/1.0.0',
          format: 'markdown',
          tags,
          wobj: objectId
            ? { wobjects: [{ author_permlink: objectId, percent: 100 }] }
            : undefined,
        }),
      });
      await broadcast([op]);
      setBody('');
      setSuccess('Thread published to Hive!');
      onPublished?.({ author: username, permlink, body: finalBody });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast thread');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handlePublish(e)}
      className="mb-4 rounded-[8px] border border-[#e9e7e7] bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#303540]">
          Quick Thread {objectId ? `on #${objectId}` : ''}
        </span>
        <span className="text-[11px] text-[#8c8c8c]">{body.length}/500 chars</span>
      </div>
      <textarea
        rows={3}
        maxLength={500}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isAuthenticated
            ? "What's cooking? Share a quick thread or tip..."
            : 'Sign in with Hive Keychain to post a thread...'
        }
        className="w-full rounded border border-[#d9d9d9] bg-[#fafafa] p-2.5 text-[13px] text-[#303540] outline-none focus:border-[#af3d36] focus:bg-white"
      />
      {error ? <p className="mt-1.5 text-[12px] text-red-600">{error}</p> : null}
      {success ? <p className="mt-1.5 text-[12px] text-[#2e7d32]">{success}</p> : null}
      <div className="mt-2 flex items-center justify-end">
        {isAuthenticated ? (
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="cursor-pointer rounded bg-[#af3d36] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#96322c] disabled:opacity-50"
          >
            {submitting ? 'Publishing...' : 'Publish Thread'}
          </button>
        ) : (
          <button
            type="button"
            onClick={openLoginModal}
            className="cursor-pointer rounded bg-[#af3d36] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#96322c]"
          >
            Sign in to Thread
          </button>
        )}
      </div>
    </form>
  );
}
