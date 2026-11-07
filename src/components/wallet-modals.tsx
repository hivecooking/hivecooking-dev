'use client';

import { useEffect, useState } from 'react';

import { openLoginModal } from '@/components/post-interactions';
import {
  buildAccountUpdate2Op,
  buildDelegateRcOp,
  buildDelegateVestingSharesOp,
  buildHiveEngineTokensOp,
  buildTransferFromSavingsOp,
  buildTransferOp,
  buildTransferToSavingsOp,
  buildTransferToVestingOp,
  buildUndelegateRcOp,
  buildWithdrawVestingOp,
  useWallet,
  type HiveOperation,
} from '@/modules/wallet';

export type WalletModalAction =
  | {
      kind: 'TRANSFER';
      symbol: string;
      precision?: number;
      availableBalance?: number;
      isEngine?: boolean;
      savingsMode?: 'NONE' | 'DEPOSIT' | 'WITHDRAW';
      defaultTo?: string;
    }
  | {
      kind: 'POWER_UP';
      symbol: string;
      precision?: number;
      availableBalance?: number;
      isEngine?: boolean;
    }
  | {
      kind: 'POWER_DOWN';
      symbol: string;
      precision?: number;
      availableStaked?: number;
      isEngine?: boolean;
      totalVestingShares?: string;
      totalVestingFundSteem?: string;
    }
  | {
      kind: 'DELEGATE';
      symbol: string;
      precision?: number;
      availableStaked?: number;
      isEngine?: boolean;
      totalVestingShares?: string;
      totalVestingFundSteem?: string;
      defaultTo?: string;
    }
  | {
      kind: 'EDIT_PROFILE';
      initialProfile: {
        displayName?: string;
        about?: string;
        location?: string;
        website?: string;
        avatarUrl?: string | null;
        coverImageUrl?: string | null;
      };
    };

function convertHpToVests(
  hpAmount: number,
  totalVestingSharesRaw?: string,
  totalVestingFundSteemRaw?: string,
): string {
  const totalVests = parseFloat(String(totalVestingSharesRaw || '349314312874.598569'));
  const totalHive = parseFloat(String(totalVestingFundSteemRaw || '217801154.288'));
  if (!Number.isFinite(totalVests) || !Number.isFinite(totalHive) || totalHive <= 0) {
    return `${(hpAmount * 1603.8).toFixed(6)} VESTS`;
  }
  const vests = (hpAmount * totalVests) / totalHive;
  return `${Math.max(0, vests).toFixed(6)} VESTS`.replace(/\s+/g, ' ').trim();
}

export function WalletActionModal({
  action,
  onClose,
  onSuccess,
}: {
  action: WalletModalAction | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { username, broadcast } = useWallet();
  const isAuthenticated = Boolean(username);

  const [toAccount, setToAccount] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [undelegateMode, setUndelegateMode] = useState(false);

  // Profile fields
  const [profName, setProfName] = useState('');
  const [profAbout, setProfAbout] = useState('');
  const [profLocation, setProfLocation] = useState('');
  const [profWebsite, setProfWebsite] = useState('');
  const [profAvatar, setProfAvatar] = useState('');
  const [profCover, setProfCover] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    setError(null);
    setTxId(null);
    setSubmitting(false);
    setAmountInput('');
    setMemoInput('');
    setUndelegateMode(false);

    if (action.kind === 'TRANSFER') {
      setToAccount(
        action.defaultTo ??
          (action.savingsMode && action.savingsMode !== 'NONE' ? username || '' : ''),
      );
    } else if (action.kind === 'POWER_UP') {
      setToAccount(username || '');
    } else if (action.kind === 'DELEGATE') {
      setToAccount(action.defaultTo ?? '');
    } else if (action.kind === 'EDIT_PROFILE') {
      setProfName(action.initialProfile.displayName || '');
      setProfAbout(action.initialProfile.about || '');
      setProfLocation(action.initialProfile.location || '');
      setProfWebsite(action.initialProfile.website || '');
      setProfAvatar(action.initialProfile.avatarUrl || '');
      setProfCover(action.initialProfile.coverImageUrl || '');
    }
  }, [action, username]);

  if (!action) return null;

  const maxAmount =
    action.kind === 'TRANSFER' || action.kind === 'POWER_UP'
      ? action.availableBalance ?? 0
      : action.kind === 'POWER_DOWN' || action.kind === 'DELEGATE'
        ? action.availableStaked ?? 0
        : 0;

  const precision =
    action.kind !== 'EDIT_PROFILE'
      ? action.precision ?? (action.symbol === 'WAIV' ? 8 : 3)
      : 3;

  const handleSetMax = () => {
    if (maxAmount > 0) {
      setAmountInput(maxAmount.toFixed(Math.min(precision, 6)).replace(/\.?0+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !username) {
      openLoginModal();
      return;
    }

    setSubmitting(true);
    setError(null);
    setTxId(null);

    try {
      let ops: HiveOperation[] = [];

      if (action.kind === 'EDIT_PROFILE') {
        const metadata = JSON.stringify({
          profile: {
            name: profName.trim(),
            about: profAbout.trim(),
            location: profLocation.trim(),
            website: profWebsite.trim(),
            profile_image: profAvatar.trim(),
            cover_image: profCover.trim(),
            version: 2,
          },
        });
        ops = [
          buildAccountUpdate2Op({
            account: username,
            json_metadata: '',
            posting_json_metadata: metadata,
          }),
        ];
      } else {
        const num = parseFloat(amountInput);
        const cleanTo = toAccount.trim().toLowerCase().replace(/^@/, '');

        if (action.kind === 'TRANSFER') {
          if (!cleanTo) throw new Error('Please enter a recipient Hive account.');
          if (!Number.isFinite(num) || num <= 0) throw new Error('Please enter a valid amount.');
          const savingsMode = action.savingsMode ?? 'NONE';

          if (savingsMode === 'DEPOSIT') {
            const sym = action.symbol === 'HBD' ? 'HBD' : 'HIVE';
            ops = [
              buildTransferToSavingsOp({
                from: username,
                to: cleanTo,
                amount: `${num.toFixed(3)} ${sym}`,
                memo: memoInput,
              }),
            ];
          } else if (savingsMode === 'WITHDRAW') {
            const sym = action.symbol === 'HBD' ? 'HBD' : 'HIVE';
            ops = [
              buildTransferFromSavingsOp({
                from: username,
                to: cleanTo,
                amount: `${num.toFixed(3)} ${sym}`,
                memo: memoInput,
              }),
            ];
          } else if (!action.isEngine && (action.symbol === 'HIVE' || action.symbol === 'HBD')) {
            ops = [
              buildTransferOp({
                from: username,
                to: cleanTo,
                amount: `${num.toFixed(3)} ${action.symbol}`,
                memo: memoInput,
              }),
            ];
          } else {
            ops = [
              buildHiveEngineTokensOp({
                account: username,
                contractAction: 'transfer',
                payload: {
                  symbol: action.symbol,
                  to: cleanTo,
                  quantity: num.toFixed(precision).replace(/\.?0+$/, '') || String(num),
                  memo: memoInput,
                },
              }),
            ];
          }
        } else if (action.kind === 'POWER_UP') {
          if (!Number.isFinite(num) || num <= 0)
            throw new Error('Please enter a valid amount to power up.');
          const target = cleanTo || username;
          if (!action.isEngine && action.symbol === 'HIVE') {
            ops = [
              buildTransferToVestingOp({
                from: username,
                to: target,
                amount: `${num.toFixed(3)} HIVE`,
              }),
            ];
          } else {
            ops = [
              buildHiveEngineTokensOp({
                account: username,
                contractAction: 'stake',
                payload: {
                  symbol: action.symbol,
                  to: target,
                  quantity: num.toFixed(precision).replace(/\.?0+$/, '') || String(num),
                },
              }),
            ];
          }
        } else if (action.kind === 'POWER_DOWN') {
          if (!Number.isFinite(num) || num <= 0)
            throw new Error('Please enter a valid amount to power down.');
          if (!action.isEngine && (action.symbol === 'HP' || action.symbol === 'HIVE')) {
            const vestingShares = convertHpToVests(
              num,
              action.totalVestingShares,
              action.totalVestingFundSteem,
            );
            ops = [
              buildWithdrawVestingOp({
                account: username,
                vestingShares,
              }),
            ];
          } else {
            ops = [
              buildHiveEngineTokensOp({
                account: username,
                contractAction: 'unstake',
                payload: {
                  symbol: action.symbol,
                  quantity: num.toFixed(precision).replace(/\.?0+$/, '') || String(num),
                },
              }),
            ];
          }
        } else if (action.kind === 'DELEGATE') {
          if (!cleanTo) throw new Error('Please enter a delegatee Hive account.');
          if (!undelegateMode && (!Number.isFinite(num) || num <= 0)) {
            throw new Error('Please enter a valid delegation amount.');
          }

          if (action.symbol === 'RC') {
            ops = [
              undelegateMode
                ? buildUndelegateRcOp({
                    from: username,
                    to: cleanTo,
                    rc: 0,
                  })
                : buildDelegateRcOp({
                    from: username,
                    to: cleanTo,
                    rc: Math.round(num * 1_000_000_000),
                  }),
            ];
          } else if (!action.isEngine && (action.symbol === 'HP' || action.symbol === 'HIVE')) {
            const effectiveHp = undelegateMode ? 0 : num;
            const vestingShares = convertHpToVests(
              effectiveHp,
              action.totalVestingShares,
              action.totalVestingFundSteem,
            );
            ops = [
              buildDelegateVestingSharesOp({
                delegator: username,
                delegatee: cleanTo,
                vestingShares,
              }),
            ];
          } else {
            if (!Number.isFinite(num) || num <= 0) {
              throw new Error('Please enter an amount greater than 0.');
            }
            ops = [
              buildHiveEngineTokensOp({
                account: username,
                contractAction: undelegateMode ? 'undelegate' : 'delegate',
                payload: {
                  symbol: action.symbol,
                  to: cleanTo,
                  quantity: num.toFixed(precision).replace(/\.?0+$/, '') || String(num),
                },
              }),
            ];
          }
        }
      }

      const res = await broadcast(ops);
      setTxId(res.transactionId);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction broadcast failed');
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    action.kind === 'EDIT_PROFILE'
      ? 'Edit Hive Profile'
      : action.kind === 'TRANSFER'
        ? action.savingsMode === 'DEPOSIT'
          ? `Deposit ${action.symbol} to Savings`
          : action.savingsMode === 'WITHDRAW'
            ? `Withdraw ${action.symbol} from Savings (3-Day Unbonding)`
            : `Transfer ${action.symbol}`
        : action.kind === 'POWER_UP'
          ? `Power Up / Stake ${action.symbol}`
          : action.kind === 'POWER_DOWN'
            ? `Power Down / Unstake ${action.symbol}`
            : `Delegate ${action.symbol}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[6px] border border-[#e0e0e0] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#efefef] pb-3">
          <h3 className="text-[17px] font-bold text-[#303540]">{modalTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[18px] leading-none text-[#8c8c8c] hover:text-[#303540]"
          >
            ✕
          </button>
        </div>

        {txId ? (
          <div className="space-y-4">
            <div className="rounded border border-[#2e7d32]/30 bg-[#edf7ed] p-3.5 text-[13px] text-[#1e4620]">
              <div className="font-bold">✓ Transaction Broadcasted via Hive Keychain!</div>
              <div className="mt-1 break-all">
                Tx ID: <code className="rounded bg-white px-1 py-0.5 text-[11px]">{txId}</code>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded bg-[#af3d36] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#96322c]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {action.kind === 'EDIT_PROFILE' ? (
              <>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    placeholder="Your display name"
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    About / Bio
                  </label>
                  <textarea
                    rows={3}
                    value={profAbout}
                    onChange={(e) => setProfAbout(e.target.value)}
                    placeholder="Short bio about your culinary interests..."
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Location
                    </label>
                    <input
                      type="text"
                      value={profLocation}
                      onChange={(e) => setProfLocation(e.target.value)}
                      placeholder="City, Country"
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Website
                    </label>
                    <input
                      type="url"
                      value={profWebsite}
                      onChange={(e) => setProfWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    Profile Picture URL
                  </label>
                  <input
                    type="url"
                    value={profAvatar}
                    onChange={(e) => setProfAvatar(e.target.value)}
                    placeholder="https://images.hive.blog/..."
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    Cover Image URL
                  </label>
                  <input
                    type="url"
                    value={profCover}
                    onChange={(e) => setProfCover(e.target.value)}
                    placeholder="https://images.hive.blog/..."
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="rounded bg-[#f9fafb] px-3 py-2 text-[12px] text-[#595959]">
                  From: <strong className="text-[#303540]">@{username || 'guest'}</strong>
                  {maxAmount > 0 ? (
                    <span className="float-right">
                      Available:{' '}
                      <strong className="text-[#303540]">
                        {maxAmount.toLocaleString('en-US', { maximumFractionDigits: 4 })}{' '}
                        {action.symbol}
                      </strong>
                    </span>
                  ) : null}
                </div>

                {action.kind === 'DELEGATE' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUndelegateMode(false)}
                      className={`flex-1 cursor-pointer rounded border py-1.5 text-[12px] font-semibold ${
                        !undelegateMode
                          ? 'border-[#af3d36] bg-[#af3d36] text-white'
                          : 'border-[#d9d9d9] bg-white text-[#595959]'
                      }`}
                    >
                      Delegate
                    </button>
                    <button
                      type="button"
                      onClick={() => setUndelegateMode(true)}
                      className={`flex-1 cursor-pointer rounded border py-1.5 text-[12px] font-semibold ${
                        undelegateMode
                          ? 'border-[#af3d36] bg-[#af3d36] text-white'
                          : 'border-[#d9d9d9] bg-white text-[#595959]'
                      }`}
                    >
                      Undelegate / Remove
                    </button>
                  </div>
                ) : null}

                {action.kind !== 'POWER_DOWN' ? (
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      {action.kind === 'DELEGATE'
                        ? undelegateMode
                          ? 'Account to Undelegate From'
                          : 'Delegatee Account'
                        : 'To Account'}
                    </label>
                    <input
                      type="text"
                      value={toAccount}
                      onChange={(e) => setToAccount(e.target.value)}
                      placeholder="e.g. hivecooking"
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                ) : null}

                {!(
                  action.kind === 'DELEGATE' &&
                  undelegateMode &&
                  (action.symbol === 'HP' || action.symbol === 'RC')
                ) ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-[12px] font-bold text-[#595959]">
                        Amount ({action.symbol === 'RC' ? 'Billion RC' : action.symbol})
                      </label>
                      {maxAmount > 0 ? (
                        <button
                          type="button"
                          onClick={handleSetMax}
                          className="cursor-pointer text-[11px] font-bold text-[#af3d36] hover:underline"
                        >
                          MAX ({maxAmount.toFixed(3)})
                        </button>
                      ) : null}
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="0.000"
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[14px] font-semibold text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                ) : (
                  <p className="rounded bg-[#fff5f4] p-2.5 text-[12px] text-[#af3d36]">
                    This will set your {action.symbol} delegation to{' '}
                    <strong>@{toAccount || '...'}</strong> to 0.
                  </p>
                )}

                {action.kind === 'TRANSFER' ? (
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Memo (Optional, public on blockchain)
                    </label>
                    <input
                      type="text"
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      placeholder="Optional memo..."
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                ) : null}
              </>
            )}

            {error ? (
              <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-4 py-2 text-[13px] font-medium text-[#595959] hover:bg-[#f5f5f5]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="cursor-pointer rounded bg-[#af3d36] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#96322c] disabled:opacity-50"
              >
                {submitting ? 'Signing with Keychain...' : 'Confirm & Broadcast'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
