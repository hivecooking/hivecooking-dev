'use client';

import { useCallback, useEffect, useState } from 'react';

import { openLoginModal } from '@/components/post-interactions';
import { fetchObjectUpdates, type ObjectUpdateItem } from '@/modules/query-api';
import {
  buildOdlUpdateCreateWithLikeOp,
  buildOdlUpdateVoteOp,
  useWallet,
} from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

const ODL_CUSTOM_JSON_ID = 'odl-mainnet';

const COMMON_UPDATE_TYPES: Array<{
  value: string;
  label: string;
  kind: 'text' | 'json';
  placeholder: string;
  defaultLocale?: string;
}> = [
  { value: 'name', label: 'Name', kind: 'text', placeholder: 'Object display name', defaultLocale: 'en-US' },
  { value: 'title', label: 'Subtitle / Short Title', kind: 'text', placeholder: 'Short subtitle or tagline', defaultLocale: 'en-US' },
  { value: 'description', label: 'Description', kind: 'text', placeholder: 'Full markdown description...', defaultLocale: 'en-US' },
  { value: 'avatar', label: 'Avatar Image URL', kind: 'text', placeholder: 'https://images.hive.blog/...' },
  { value: 'background', label: 'Background / Banner Image URL', kind: 'text', placeholder: 'https://images.hive.blog/...' },
  { value: 'price', label: 'Price', kind: 'text', placeholder: '$19.99', defaultLocale: 'en-US' },
  { value: 'calories', label: 'Calories', kind: 'text', placeholder: '320 kcal', defaultLocale: 'en-US' },
  { value: 'cookingTime', label: 'Cooking Time', kind: 'text', placeholder: '35 mins', defaultLocale: 'en-US' },
  { value: 'nutrition', label: 'Nutrition Facts', kind: 'text', placeholder: 'Protein 18g, Carbs 42g, Fat 12g', defaultLocale: 'en-US' },
  {
    value: 'recipeIngredients',
    label: 'Recipe Ingredients (JSON Array)',
    kind: 'json',
    placeholder: '["2 cups flour", "3 eggs", "1 tsp olive oil"]',
    defaultLocale: 'en-US',
  },
  {
    value: 'listItem',
    label: 'Add List Item Reference (JSON)',
    kind: 'json',
    placeholder: '{"id": "target-object-id"}',
  },
];

export function ObjectEditModal({
  objectId,
  objectName,
  open,
  onClose,
  onUpdated,
}: {
  objectId: string;
  objectName: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);
  const [tab, setTab] = useState<'CREATE' | 'HISTORY'>('CREATE');
  const [updateType, setUpdateType] = useState('description');
  const [valueInput, setValueInput] = useState('');
  const [localeInput, setLocaleInput] = useState('en-US');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  // History state
  const [updates, setUpdates] = useState<ObjectUpdateItem[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const loadUpdates = useCallback(async () => {
    if (!objectId) return;
    setLoadingUpdates(true);
    const res = await fetchObjectUpdates(objectId, { limit: 40, include_rejected: true });
    setLoadingUpdates(false);
    if (isOk(res)) {
      setUpdates(res.value.items ?? []);
    }
  }, [objectId]);

  useEffect(() => {
    if (open && tab === 'HISTORY') {
      void loadUpdates();
    }
  }, [open, tab, loadUpdates]);

  if (!open) return null;

  const selectedMeta =
    COMMON_UPDATE_TYPES.find((u) => u.value === updateType) ?? COMMON_UPDATE_TYPES[0];

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    const trimmed = valueInput.trim();
    if (!trimmed) {
      setError('Please enter a value for the update.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setTxId(null);

    try {
      let parsedValue: unknown = trimmed;
      if (selectedMeta.kind === 'json') {
        try {
          parsedValue = JSON.parse(trimmed);
        } catch {
          throw new Error('Invalid JSON value. Please enter valid JSON.');
        }
      }

      const op = buildOdlUpdateCreateWithLikeOp({
        id: ODL_CUSTOM_JSON_ID,
        objectId,
        updateType,
        creator: username,
        valueKind: selectedMeta.kind === 'json' ? 'json' : 'text',
        value: parsedValue,
        locale: selectedMeta.defaultLocale ? localeInput || 'en-US' : undefined,
      });

      const res = await broadcast([op]);
      setTxId(res.transactionId);
      setValueInput('');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast object update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteUpdate = async (updateId: string, vote: 'for' | 'against') => {
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }
    setVotingId(updateId);
    setError(null);
    try {
      const op = buildOdlUpdateVoteOp({
        id: ODL_CUSTOM_JSON_ID,
        voter: username,
        objectId,
        updateId,
        vote,
      });
      await broadcast([op]);
      setUpdates((prev) =>
        prev.map((u) =>
          u.update_id === updateId
            ? {
                ...u,
                viewer_vote: vote,
                votes_count: (u.votes_count ?? 0) + 1,
              }
            : u,
        ),
      );
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col rounded-[6px] border border-[#e0e0e0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-3.5">
          <div>
            <h3 className="text-[17px] font-bold text-[#303540]">
              Edit Object: {objectName}
            </h3>
            <p className="text-[12px] text-[#8c8c8c]">#{objectId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[18px] leading-none text-[#8c8c8c] hover:text-[#303540]"
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-[#efefef] bg-[#fafafa] px-5">
          <button
            type="button"
            onClick={() => setTab('CREATE')}
            className={`cursor-pointer border-b-2 px-4 py-2.5 text-[13px] font-bold transition-colors ${
              tab === 'CREATE'
                ? 'border-[#af3d36] text-[#af3d36]'
                : 'border-transparent text-[#595959] hover:text-[#303540]'
            }`}
          >
            + Propose Update
          </button>
          <button
            type="button"
            onClick={() => setTab('HISTORY')}
            className={`cursor-pointer border-b-2 px-4 py-2.5 text-[13px] font-bold transition-colors ${
              tab === 'HISTORY'
                ? 'border-[#af3d36] text-[#af3d36]'
                : 'border-transparent text-[#595959] hover:text-[#303540]'
            }`}
          >
            Updates &amp; Votes
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'CREATE' ? (
            <form onSubmit={(e) => void handleSubmitUpdate(e)} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    Field / Update Type
                  </label>
                  <select
                    value={updateType}
                    onChange={(e) => {
                      setUpdateType(e.target.value);
                      setTxId(null);
                      setError(null);
                    }}
                    className="w-full rounded border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  >
                    {COMMON_UPDATE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.value})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMeta.defaultLocale ? (
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Locale
                    </label>
                    <input
                      type="text"
                      value={localeInput}
                      onChange={(e) => setLocaleInput(e.target.value)}
                      placeholder="en-US"
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                  {selectedMeta.kind === 'json' ? 'JSON Value' : 'Update Value'}
                </label>
                <textarea
                  rows={6}
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder={selectedMeta.placeholder}
                  className="w-full rounded border border-[#d9d9d9] p-3 font-mono text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>

              {error ? (
                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              ) : null}

              {txId ? (
                <div className="rounded border border-[#2e7d32]/30 bg-[#edf7ed] px-3 py-2.5 text-[12px] text-[#1e4620]">
                  ✓ Object update broadcasted! Tx ID: <code>{txId}</code>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-4 py-2 text-[13px] font-medium text-[#595959] hover:bg-[#f5f5f5]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer rounded bg-[#af3d36] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#96322c] disabled:opacity-50"
                >
                  {submitting ? 'Signing with Keychain...' : 'Publish Update'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {error ? (
                <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              ) : null}
              {loadingUpdates ? (
                <div className="py-8 text-center text-[13px] text-[#8c8c8c]">
                  Loading object updates...
                </div>
              ) : updates.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-[#8c8c8c]">
                  No updates found for this object.
                </div>
              ) : (
                updates.map((u) => {
                  const displayVal =
                    u.value_text ??
                    (u.value_json != null ? JSON.stringify(u.value_json) : '') ??
                    '';
                  return (
                    <div
                      key={u.update_id}
                      className="rounded border border-[#e8e8e8] bg-[#fafafa] p-3 text-[13px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#303540] px-2 py-0.5 text-[11px] font-bold text-white">
                            {u.update_type}
                          </span>
                          <span className="text-[12px] font-semibold text-[#af3d36]">
                            @{u.creator}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              u.validity_status === 'VALID'
                                ? 'bg-[#edf7ed] text-[#2e7d32]'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {u.validity_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={votingId === u.update_id}
                            onClick={() => void handleVoteUpdate(u.update_id, 'for')}
                            className={`cursor-pointer rounded border px-2.5 py-1 text-[11px] font-semibold ${
                              u.viewer_vote === 'for'
                                ? 'border-[#2e7d32] bg-[#2e7d32] text-white'
                                : 'border-[#d9d9d9] bg-white text-[#2e7d32] hover:border-[#2e7d32]'
                            }`}
                          >
                            👍 Approve
                          </button>
                          <button
                            type="button"
                            disabled={votingId === u.update_id}
                            onClick={() => void handleVoteUpdate(u.update_id, 'against')}
                            className={`cursor-pointer rounded border px-2.5 py-1 text-[11px] font-semibold ${
                              u.viewer_vote === 'against'
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-[#d9d9d9] bg-white text-red-600 hover:border-red-600'
                            }`}
                          >
                            👎 Reject
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 max-h-[120px] overflow-y-auto rounded bg-white p-2 font-mono text-[12px] break-all text-[#303540]">
                        {displayVal}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
