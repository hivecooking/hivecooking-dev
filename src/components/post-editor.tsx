'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { openLoginModal, renderSimpleMarkdown } from '@/components/post-interactions';
import {
  fetchSearch,
  getObjectAvatarUrl,
  getObjectDisplayName,
  resolveObject,
} from '@/modules/query-api';
import {
  buildCommentOp,
  buildCommentOptionsBeneficiaryExtension,
  buildCommentOptionsOp,
  useWallet,
  type HiveOperation,
} from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

const DRAFT_STORAGE_KEY = 'hivecooking_editor_draft_v1';

interface LinkedObjectItem {
  object_id: string;
  name: string;
  object_type: string;
  image_url?: string | null;
}

type RewardOption = '50_50' | '100_HP' | 'DECLINE';

function createPostPermlink(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
  const suffix = Date.now().toString(36);
  return base ? `${base}-${suffix}` : `post-${suffix}`;
}

export function PostEditor({
  initialObjectId,
  initialObjectName,
  initialObjectType,
}: {
  initialObjectId?: string;
  initialObjectName?: string;
  initialObjectType?: string;
}) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('hivecooking, food, recipe, waivio');
  const [linkedObjects, setLinkedObjects] = useState<LinkedObjectItem[]>([]);
  const [viewMode, setViewMode] = useState<'SPLIT' | 'EDIT' | 'PREVIEW'>('SPLIT');
  const [rewardOption, setRewardOption] = useState<RewardOption>('50_50');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryPercent, setBeneficiaryPercent] = useState(5);
  const [beneficiaries, setBeneficiaries] = useState<Array<{ account: string; weight: number }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Object search state
  const [objQuery, setObjQuery] = useState('');
  const [objResults, setObjResults] = useState<LinkedObjectItem[]>([]);
  const [objSearching, setObjSearching] = useState(false);

  // Image URL helper modal/inline
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');

  // Broadcast state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedPost, setPublishedPost] = useState<{
    author: string;
    permlink: string;
    txId: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Hydrate draft or query params on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          title?: string;
          body?: string;
          tagsInput?: string;
          linkedObjects?: LinkedObjectItem[];
        };
        if (parsed.title) setTitle(parsed.title);
        if (parsed.body) setBody(parsed.body);
        if (parsed.tagsInput) setTagsInput(parsed.tagsInput);
        if (Array.isArray(parsed.linkedObjects) && parsed.linkedObjects.length > 0) {
          setLinkedObjects(parsed.linkedObjects);
        }
      }
    } catch {
      // Ignore draft parse error
    }

    const params = new URLSearchParams(window.location.search);
    const qObject = initialObjectId || params.get('object') || '';
    const qName = initialObjectName || params.get('name') || '';
    const qType = initialObjectType || params.get('type') || 'object';

    if (qObject) {
      if (qName) {
        setLinkedObjects((prev) => {
          if (prev.some((o) => o.object_id === qObject)) return prev;
          return [...prev, { object_id: qObject, name: qName, object_type: qType }];
        });
        setTitle((prev) => prev || `Review: ${qName}`);
        setBody((prev) =>
          prev.includes(`/object/${qObject}`)
            ? prev
            : `${prev ? `${prev}\n\n` : ''}### [${qName}](/object/${qObject})\n\nWrite your review or culinary notes here...`,
        );
      } else {
        void resolveObject({ object_id: qObject }).then((res) => {
          if (isOk(res)) {
            const resolved = res.value;
            const rName = getObjectDisplayName(resolved) || qObject;
            const rType = resolved.object_type || 'object';
            setLinkedObjects((prev) => {
              if (prev.some((o) => o.object_id === qObject)) return prev;
              return [
                ...prev,
                {
                  object_id: qObject,
                  name: rName,
                  object_type: rType,
                  image_url: getObjectAvatarUrl(resolved),
                },
              ];
            });
            setTitle((prev) => prev || `Review: ${rName}`);
            setBody((prev) =>
              prev.includes(`/object/${qObject}`)
                ? prev
                : `${prev ? `${prev}\n\n` : ''}### [${rName}](/object/${qObject})\n\nWrite your review or culinary notes here...`,
            );
          } else {
            setLinkedObjects((prev) => {
              if (prev.some((o) => o.object_id === qObject)) return prev;
              return [...prev, { object_id: qObject, name: qObject, object_type: qType }];
            });
          }
        });
      }
    }
  }, [initialObjectId, initialObjectName, initialObjectType]);

  // Save draft to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ title, body, tagsInput, linkedObjects }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [title, body, tagsInput, linkedObjects]);

  // Search ODL objects to attach
  useEffect(() => {
    const trimmed = objQuery.trim();
    if (trimmed.length < 2) {
      setObjResults([]);
      return;
    }
    const ctrl = new AbortController();
    setObjSearching(true);
    const timer = setTimeout(() => {
      void fetchSearch({ q: trimmed, limit: 8, type: 'objects', signal: ctrl.signal })
        .then((res) => {
          if (isOk(res)) {
            setObjResults(
              (res.value.objects ?? []).map((o) => ({
                object_id: o.object_id,
                name: o.name || o.object_id,
                object_type: o.object_type,
                image_url: o.image_url,
              })),
            );
          }
        })
        .finally(() => setObjSearching(false));
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [objQuery]);

  const insertMarkdown = (prefix: string, suffix = '', placeholder = '') => {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => `${prev}${prefix}${placeholder}${suffix}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const selected = body.slice(start, end) || placeholder;
    const next = `${body.slice(0, start)}${prefix}${selected}${suffix}${body.slice(end)}`;
    setBody(next);
    setTimeout(() => {
      el.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const handleAttachObject = (obj: LinkedObjectItem) => {
    setLinkedObjects((prev) => {
      if (prev.some((item) => item.object_id === obj.object_id)) return prev;
      return [...prev, obj];
    });
    const linkMarkdown = `[${obj.name}](/object/${obj.object_id})`;
    if (!body.includes(`/object/${obj.object_id}`)) {
      setBody((prev) => (prev ? `${prev}\n\n${linkMarkdown}` : `${linkMarkdown}\n\n`));
    }
    setObjQuery('');
    setObjResults([]);
  };

  const handleRemoveLinkedObject = (objectId: string) => {
    setLinkedObjects((prev) => prev.filter((item) => item.object_id !== objectId));
  };

  const parsedTags = useMemo(() => {
    const raw = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]/g, ''))
      .filter(Boolean);
    const unique = Array.from(new Set(['hivecooking', ...raw]));
    return unique.slice(0, 10);
  }, [tagsInput]);

  const handleAddBeneficiary = () => {
    const clean = beneficiaryAccount.trim().toLowerCase().replace(/^@/, '');
    if (!clean || beneficiaryPercent <= 0 || beneficiaryPercent > 100) return;
    setBeneficiaries((prev) => {
      const filtered = prev.filter((b) => b.account !== clean);
      return [...filtered, { account: clean, weight: Math.round(beneficiaryPercent * 100) }];
    });
    setBeneficiaryAccount('');
  };

  const handleClearDraft = () => {
    setTitle('');
    setBody('');
    setLinkedObjects([]);
    setPublishedPost(null);
    setError(null);
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle) {
      setError('Please enter a title for your post.');
      return;
    }
    if (!cleanBody) {
      setError('Please write some content for your post.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setPublishedPost(null);

    try {
      const permlink = createPostPermlink(cleanTitle);
      const primaryTag = parsedTags[0] || 'hivecooking';

      // Ensure linked objects are referenced in the body or metadata for ODL indexing
      const wobjects = linkedObjects.map((o) => ({
        author_permlink: o.object_id,
        percent: Math.floor(100 / Math.max(1, linkedObjects.length)),
      }));

      const jsonMetadata = JSON.stringify({
        app: 'hivecooking/1.0.0',
        format: 'markdown',
        tags: parsedTags,
        objects: linkedObjects.map((o) => o.object_id),
        wobj: wobjects.length > 0 ? { wobjects } : undefined,
      });

      const ops: HiveOperation[] = [
        buildCommentOp({
          parent_author: '',
          parent_permlink: primaryTag,
          author: username,
          permlink,
          title: cleanTitle,
          body: cleanBody,
          json_metadata: jsonMetadata,
        }),
      ];

      if (rewardOption !== '50_50' || beneficiaries.length > 0) {
        const extensions =
          beneficiaries.length > 0
            ? [buildCommentOptionsBeneficiaryExtension(beneficiaries)]
            : [];
        ops.push(
          buildCommentOptionsOp({
            author: username,
            permlink,
            max_accepted_payout:
              rewardOption === 'DECLINE' ? '0.000 HBD' : '1000000.000 HBD',
            percent_hbd: rewardOption === '100_HP' ? 0 : 10000,
            allow_votes: true,
            allow_curation_rewards: true,
            extensions,
          }),
        );
      }

      const res = await broadcast(ops);
      setPublishedPost({
        author: username,
        permlink,
        txId: res.transactionId,
      });
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#303540]">
            Write a Post or Culinary Review
          </h1>
          <p className="text-[13px] text-[#8c8c8c]">
            Publish recipes, reviews, and food stories to the Hive blockchain &amp; Open Data Layer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-[#d9d9d9] bg-white p-0.5 text-[12px]">
            {(['EDIT', 'SPLIT', 'PREVIEW'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`cursor-pointer rounded px-2.5 py-1 font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-[#af3d36] text-white'
                    : 'text-[#595959] hover:text-[#af3d36]'
                }`}
              >
                {mode === 'EDIT' ? 'Editor' : mode === 'SPLIT' ? 'Split View' : 'Preview'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleClearDraft}
            className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-3 py-1.5 text-[12px] font-medium text-[#595959] hover:border-[#af3d36] hover:text-[#af3d36]"
          >
            Clear Draft
          </button>
        </div>
      </div>

      {publishedPost ? (
        <div className="mb-6 rounded-[6px] border border-[#2e7d32]/30 bg-[#edf7ed] p-4 text-[#1e4620]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold">🎉 Post Published Successfully!</h3>
              <p className="mt-1 text-[13px]">
                Transaction ID:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 text-[12px]">
                  {publishedPost.txId}
                </code>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/@${publishedPost.author}/${publishedPost.permlink}`}
                className="rounded bg-[#2e7d32] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-95"
              >
                View Published Post →
              </Link>
              <Link
                href={`/@${publishedPost.author}`}
                className="rounded border border-[#2e7d32] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#2e7d32]"
              >
                My Profile
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void handlePublish(e)} className="space-y-5">
        {/* Title */}
        <div className="rounded-[4px] border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <label className="mb-1.5 block text-[12px] font-bold tracking-wide text-[#595959] uppercase">
            Post Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Authentic Homemade Pasta Carbonara — Recipe & Review"
            className="w-full rounded border border-[#d9d9d9] px-3.5 py-2.5 text-[18px] font-bold text-[#303540] outline-none focus:border-[#af3d36]"
          />
        </div>

        {/* Formatting Toolbar + Editor / Preview */}
        <div className="rounded-[4px] border border-[#e0e0e0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center gap-1 border-b border-[#e8e8e8] bg-[#fafafa] px-3 py-2">
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**', 'bold text')}
              title="Bold"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] font-bold text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*', 'italic text')}
              title="Italic"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] italic text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n## ', '\n', 'Section Heading')}
              title="Heading 2"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] font-semibold text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n### ', '\n', 'Subheading')}
              title="Heading 3"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] font-semibold text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              H3
            </button>
            <span className="mx-1 h-4 w-[1px] bg-[#e0e0e0]" />
            <button
              type="button"
              onClick={() => insertMarkdown('[', '](https://example.com)', 'link text')}
              title="Insert Link"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              🔗 Link
            </button>
            <button
              type="button"
              onClick={() => setShowImagePrompt((prev) => !prev)}
              title="Insert Image URL"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              🖼️ Image
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n> ', '\n', 'Quoted text')}
              title="Blockquote"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              ❝ Quote
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n- ', '\n- Item 2\n', 'Item 1')}
              title="Bullet List"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 text-[13px] text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n```\n', '\n```\n', 'code')}
              title="Code Block"
              className="cursor-pointer rounded border border-transparent px-2.5 py-1 font-mono text-[12px] text-[#303540] hover:border-[#d9d9d9] hover:bg-white"
            >
              {'</>'}
            </button>
          </div>

          {showImagePrompt ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[#e8e8e8] bg-[#fffaf9] px-4 py-2.5">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://images.hive.blog/... (Image URL)"
                className="min-w-[240px] flex-1 rounded border border-[#d9d9d9] bg-white px-2.5 py-1 text-[13px] outline-none focus:border-[#af3d36]"
              />
              <input
                type="text"
                value={imageAltInput}
                onChange={(e) => setImageAltInput(e.target.value)}
                placeholder="Image caption / alt text"
                className="w-[180px] rounded border border-[#d9d9d9] bg-white px-2.5 py-1 text-[13px] outline-none focus:border-[#af3d36]"
              />
              <button
                type="button"
                onClick={() => {
                  if (imageUrlInput.trim()) {
                    insertMarkdown(
                      `\n![${imageAltInput.trim() || 'image'}](${imageUrlInput.trim()})\n`,
                    );
                    setImageUrlInput('');
                    setImageAltInput('');
                    setShowImagePrompt(false);
                  }
                }}
                className="cursor-pointer rounded bg-[#af3d36] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#96322c]"
              >
                Insert Image
              </button>
              <button
                type="button"
                onClick={() => setShowImagePrompt(false)}
                className="cursor-pointer text-[12px] text-[#8c8c8c] hover:text-[#303540]"
              >
                Cancel
              </button>
            </div>
          ) : null}

          <div
            className={`grid ${
              viewMode === 'SPLIT'
                ? 'grid-cols-1 md:grid-cols-2 md:divide-x md:divide-[#e8e8e8]'
                : 'grid-cols-1'
            }`}
          >
            {viewMode !== 'PREVIEW' ? (
              <div className="p-3">
                <textarea
                  ref={textareaRef}
                  rows={16}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your recipe, review, or culinary article in Markdown..."
                  className="w-full resize-y border-0 bg-transparent p-1 font-mono text-[14px] leading-[1.6] text-[#303540] outline-none"
                />
              </div>
            ) : null}

            {viewMode !== 'EDIT' ? (
              <div className="bg-[#fcfcfc] p-4">
                <div className="mb-2 text-[11px] font-bold tracking-wider text-[#99aab5] uppercase">
                  Live Preview
                </div>
                {title ? (
                  <h2 className="mb-3 text-[22px] font-bold text-[#303540]">{title}</h2>
                ) : null}
                {body.trim() ? (
                  <div
                    className="prose max-w-none text-[15px] leading-[1.65] text-[#303540]"
                    dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(body) }}
                  />
                ) : (
                  <p className="text-[13px] italic text-[#99aab5]">
                    Your formatted post preview will appear here...
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Linked ODL Objects (Recipes, Products, Restaurants, Ingredients) */}
        <div className="rounded-[4px] border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <label className="mb-1 block text-[12px] font-bold tracking-wide text-[#595959] uppercase">
            Linked Objects (Recipes, Dishes, Ingredients, Products, Lists)
          </label>
          <p className="mb-3 text-[12px] text-[#8c8c8c]">
            Link ODL objects so your post appears under their Reviews tab on HiveCooking &amp; Waivio.
          </p>

          {linkedObjects.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {linkedObjects.map((obj) => (
                <div
                  key={obj.object_id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#af3d36]/30 bg-[#fff5f4] py-1 pr-2.5 pl-3 text-[13px] text-[#303540]"
                >
                  <span className="rounded bg-[#af3d36] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                    {obj.object_type}
                  </span>
                  <Link
                    href={`/object/${obj.object_id}`}
                    className="font-semibold text-[#af3d36] hover:underline"
                  >
                    {obj.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemoveLinkedObject(obj.object_id)}
                    className="cursor-pointer text-[#8c8c8c] hover:text-red-600"
                    title="Remove linked object"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="relative">
            <input
              type="text"
              value={objQuery}
              onChange={(e) => setObjQuery(e.target.value)}
              placeholder="Search to attach a recipe, ingredient, restaurant, or product..."
              className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
            />
            {objSearching ? (
              <span className="absolute top-2.5 right-3 text-[12px] text-[#8c8c8c]">
                Searching...
              </span>
            ) : null}
            {objResults.length > 0 ? (
              <div className="absolute top-full right-0 left-0 z-40 mt-1 max-h-[240px] overflow-y-auto rounded border border-[#e0e0e0] bg-white shadow-lg">
                {objResults.map((item) => (
                  <button
                    key={item.object_id}
                    type="button"
                    onClick={() => handleAttachObject(item)}
                    className="flex w-full cursor-pointer items-center justify-between border-b border-[#f0f0f0] px-3 py-2 text-left text-[13px] hover:bg-[#fff5f4] last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-7 w-7 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-[#f0f0f0] text-[10px] font-bold text-[#8c8c8c]">
                          {item.object_type.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-[#303540]">{item.name}</div>
                        <div className="text-[11px] text-[#8c8c8c]">#{item.object_id}</div>
                      </div>
                    </div>
                    <span className="rounded bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-medium text-[#595959] uppercase">
                      + Attach {item.object_type}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Topics / Tags & Advanced Settings */}
        <div className="rounded-[4px] border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="mb-3">
            <label className="mb-1 block text-[12px] font-bold tracking-wide text-[#595959] uppercase">
              Topics / Tags (comma or space separated, up to 10)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="hivecooking, food, recipe, waivio"
              className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsedTags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-[#f2f4f7] px-2 py-0.5 text-[12px] font-medium text-[#595959]"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="cursor-pointer text-[13px] font-semibold text-[#af3d36] hover:underline"
          >
            {showAdvanced
              ? '▾ Hide Advanced Settings (Rewards & Beneficiaries)'
              : '▸ Show Advanced Settings (Rewards & Beneficiaries)'}
          </button>

          {showAdvanced ? (
            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-[#efefef] pt-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                  Post Rewards Distribution
                </label>
                <select
                  value={rewardOption}
                  onChange={(e) => setRewardOption(e.target.value as RewardOption)}
                  className="w-full rounded border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                >
                  <option value="50_50">50% HBD / 50% HP (Default)</option>
                  <option value="100_HP">100% Power Up (HP)</option>
                  <option value="DECLINE">Decline Payout</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                  Beneficiaries (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                    placeholder="account (e.g. hivecooking)"
                    className="flex-1 rounded border border-[#d9d9d9] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#af3d36]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={beneficiaryPercent}
                    onChange={(e) => setBeneficiaryPercent(Number(e.target.value))}
                    className="w-[70px] rounded border border-[#d9d9d9] px-2 py-1.5 text-[13px] outline-none focus:border-[#af3d36]"
                  />
                  <span className="text-[12px] text-[#595959]">%</span>
                  <button
                    type="button"
                    onClick={handleAddBeneficiary}
                    className="cursor-pointer rounded bg-[#303540] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
                {beneficiaries.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {beneficiaries.map((b) => (
                      <span
                        key={b.account}
                        className="inline-flex items-center gap-1.5 rounded bg-[#f0f2f5] px-2 py-0.5 text-[12px] text-[#303540]"
                      >
                        @{b.account} ({(b.weight / 100).toFixed(0)}%)
                        <button
                          type="button"
                          onClick={() =>
                            setBeneficiaries((prev) => prev.filter((x) => x.account !== b.account))
                          }
                          className="cursor-pointer text-[#8c8c8c] hover:text-red-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        ) : null}

        {/* Submit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-[#e0e0e0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="text-[13px] text-[#595959]">
            {isAuthenticated ? (
              <span>
                Ready to broadcast as <strong className="text-[#303540]">@{username}</strong> via Hive Keychain
              </span>
            ) : (
              <span>Sign in with Hive Keychain to publish your post to the Hive blockchain.</span>
            )}
          </div>
          {isAuthenticated ? (
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer rounded bg-[#af3d36] px-6 py-2.5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-[#96322c] disabled:opacity-50"
            >
              {submitting ? 'Signing & Broadcasting...' : 'Publish Post'}
            </button>
          ) : (
            <button
              type="button"
              onClick={openLoginModal}
              className="cursor-pointer rounded bg-[#af3d36] px-6 py-2.5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-[#96322c]"
            >
              Sign in with Hive Keychain
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
