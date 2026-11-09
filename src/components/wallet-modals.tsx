'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { openLoginModal } from '@/components/post-interactions';
import {
  fetchEngineDepositAddress,
  fetchEngineDepositList,
  fetchEngineSwapList,
  fetchEngineSwapQuote,
  fetchEngineTokenDelegations,
  fetchEngineWithdrawList,
  fetchEngineWithdrawQuote,
  fetchHiveHpDelegations,
  fetchHiveRcDelegations,
  type EngineDepositAddressResponse,
  type EngineDepositListResponse,
  type EngineSwapListResponse,
  type EngineTokenDelegationsResponse,
  type EngineWithdrawListResponse,
  type HiveHpDelegationsResponse,
  type HiveRcDelegationsResponse,
} from '@/modules/query-api';
import {
  buildAccountUpdate2Op,
  buildCustomJsonOp,
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
import { isOk } from '@/shared/domain/result';

// ============================================================================
// 1. WalletActionSplit (Exact parity with Waiviogit/open-infrastructure)
// ============================================================================

export type WalletActionSplitItem = {
  id?: string;
  label: string;
  onSelect: () => void;
};

export function WalletActionSplit({
  primaryLabel,
  onPrimary,
  menuItems = [],
  menuAriaLabel,
  disabled = false,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  menuItems?: WalletActionSplitItem[];
  menuAriaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number; minWidth: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(160, rect.width),
    });
  }, [open, menuItems.length]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const hasMenu = menuItems.length > 0;

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <div
        ref={anchorRef}
        className="inline-flex overflow-hidden rounded-[24px] border border-[#af3d36] bg-white"
      >
        <button
          type="button"
          onClick={onPrimary}
          disabled={disabled}
          className="cursor-pointer px-3 py-1 text-[13px] font-medium text-[#af3d36] hover:bg-[#af3d36]/10 disabled:opacity-50"
        >
          {primaryLabel}
        </button>
        {hasMenu ? (
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="menu"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="cursor-pointer border-l border-[#af3d36] px-2 py-1 text-[#af3d36] hover:bg-[#af3d36]/10 disabled:opacity-50"
          >
            <span className="sr-only">{menuAriaLabel || `${primaryLabel} menu`}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : null}
      </div>
      {open && hasMenu && pos && mounted
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'fixed',
                top: pos.top,
                right: pos.right,
                minWidth: pos.minWidth,
                zIndex: 100,
              }}
              className="rounded-[12px] border border-[#e9e7e7] bg-white py-1 shadow-lg"
            >
              {menuItems.map((item) => (
                <button
                  key={item.id || item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className="block w-full cursor-pointer px-3.5 py-2 text-left text-[13px] text-[#333333] hover:bg-[#f5f6f7] hover:text-[#af3d36]"
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// ============================================================================
// 2. Wallet Right Sidebar Cards (Waiviogit/open-infrastructure parity)
//    Strictly gated on `canManage` (`viewerUsername === accountName`)
// ============================================================================

export function WalletActionsSidebarTop({
  canManage,
  walletType,
  onOpenAction,
}: {
  canManage: boolean;
  walletType: 'WAIV' | 'HIVE' | 'ENGINE';
  onOpenAction: (action: WalletModalAction) => void;
}) {
  if (!canManage) return null;

  const defaultSymbol = walletType === 'HIVE' ? 'HIVE' : 'WAIV';
  const isEngine = walletType !== 'HIVE';

  return (
    <div className="space-y-2 rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4">
      <button
        type="button"
        onClick={() =>
          onOpenAction({
            kind: 'TRANSFER',
            symbol: defaultSymbol,
            precision: defaultSymbol === 'WAIV' ? 8 : 3,
            isEngine,
          })
        }
        className="flex w-full cursor-pointer items-center justify-center rounded-[24px] bg-[#af3d36] px-4 py-2 text-center text-[15px] font-semibold text-white hover:bg-[#93312b]"
      >
        Transfer
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            onOpenAction({
              kind: 'POWER_UP',
              symbol: defaultSymbol,
              precision: defaultSymbol === 'WAIV' ? 8 : 3,
              isEngine,
            })
          }
          className="flex w-full cursor-pointer items-center justify-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-2 text-center text-[14px] font-medium text-[#333333] hover:border-[#af3d36] hover:text-[#af3d36]"
        >
          Power up
        </button>
        <button
          type="button"
          onClick={() =>
            onOpenAction({
              kind: 'POWER_DOWN',
              symbol: defaultSymbol === 'HIVE' ? 'HP' : 'WAIV',
              precision: defaultSymbol === 'WAIV' ? 8 : 3,
              isEngine,
            })
          }
          className="flex w-full cursor-pointer items-center justify-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-2 text-center text-[14px] font-medium text-[#333333] hover:border-[#af3d36] hover:text-[#af3d36]"
        >
          Power down
        </button>
      </div>
      <button
        type="button"
        onClick={() =>
          onOpenAction({
            kind: 'MANAGE_DELEGATIONS',
            account: '',
            initialAsset: walletType === 'HIVE' ? 'HP' : 'WAIV',
          })
        }
        className="flex w-full cursor-pointer items-center justify-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-4 py-2 text-center text-[14px] font-medium text-[#333333] hover:border-[#af3d36] hover:text-[#af3d36]"
      >
        Manage delegations
      </button>
    </div>
  );
}

export function WalletActionsSidebarBottom({
  canManage,
  walletType,
  onOpenAction,
}: {
  canManage: boolean;
  walletType: 'WAIV' | 'HIVE' | 'ENGINE';
  onOpenAction: (action: WalletModalAction) => void;
}) {
  if (!canManage) return null;
  if (walletType !== 'WAIV' && walletType !== 'ENGINE') return null;

  return (
    <div className="space-y-2 rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4">
      <button
        type="button"
        onClick={() => onOpenAction({ kind: 'SWAP', fromSymbol: 'SWAP.HIVE', toSymbol: 'WAIV' })}
        className="flex w-full cursor-pointer items-center justify-center rounded-[24px] bg-[#af3d36] px-4 py-2 text-center text-[15px] font-semibold text-white hover:bg-[#93312b]"
      >
        Swap tokens
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenAction({ kind: 'DEPOSIT', initialSymbol: 'HIVE' })}
          className="flex w-full cursor-pointer items-center justify-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-2 text-center text-[14px] font-medium text-[#333333] hover:border-[#af3d36] hover:text-[#af3d36]"
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() =>
            onOpenAction({
              kind: 'WITHDRAW',
              inputSymbol: 'WAIV',
              outputSymbol: 'HIVE',
            })
          }
          className="flex w-full cursor-pointer items-center justify-center rounded-[24px] border border-[#e9e7e7] bg-[#f5f6f7] px-3 py-2 text-center text-[14px] font-medium text-[#333333] hover:border-[#af3d36] hover:text-[#af3d36]"
        >
          Withdraw
        </button>
      </div>
    </div>
  );
}

export function ClaimRewardsSidebarCard({
  canManage,
  pendingRewards,
  claiming,
  onClaim,
}: {
  canManage: boolean;
  pendingRewards?: {
    rewardHive?: string;
    rewardHbd?: string;
    rewardVests?: string;
    hive?: string;
    hbd?: string;
    hp?: string;
  } | null;
  claiming?: boolean;
  onClaim: (rewards: { hive: string; hbd: string; vests: string }) => void;
}) {
  if (!canManage || !pendingRewards) return null;

  const rHive = String(pendingRewards.rewardHive ?? pendingRewards.hive ?? '0.000 HIVE');
  const rHbd = String(pendingRewards.rewardHbd ?? pendingRewards.hbd ?? '0.000 HBD');
  const rVests = String(pendingRewards.rewardVests ?? '0.000000 VESTS');
  const rHp = String(pendingRewards.hp ?? '');

  const showHive = parseFloat(rHive) > 0;
  const showHbd = parseFloat(rHbd) > 0;
  const showVests = parseFloat(rVests) > 0 || parseFloat(rHp) > 0;

  if (!showHive && !showHbd && !showVests) return null;

  return (
    <div className="space-y-2 rounded-[8px] border border-[#e9e7e7] bg-white/60 p-4">
      <h3 className="text-[16px] font-semibold text-[#333333]">Rewards</h3>
      <div className="divide-y divide-[#e9e7e7] border-t border-[#e9e7e7]">
        {showHive ? (
          <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="font-semibold text-[#333333]">HIVE</span>
            <span className="font-mono font-semibold text-[#333333]">{rHive}</span>
          </div>
        ) : null}
        {showHbd ? (
          <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="font-semibold text-[#333333]">HBD</span>
            <span className="font-mono font-semibold text-[#333333]">{rHbd}</span>
          </div>
        ) : null}
        {showVests ? (
          <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="font-semibold text-[#333333]">HIVE Power</span>
            <span className="font-mono font-semibold text-[#333333]">
              {rHp ? `${rHp} HP` : rVests}
            </span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={claiming}
        onClick={() => onClaim({ hive: rHive, hbd: rHbd, vests: rVests })}
        className="flex w-full cursor-pointer items-center justify-center rounded-[24px] bg-[#af3d36] px-4 py-2 text-center text-[14px] font-semibold text-white hover:bg-[#93312b] disabled:opacity-50"
      >
        {claiming ? 'Claiming...' : 'Claim rewards'}
      </button>
    </div>
  );
}

// ============================================================================
// 3. Unified WalletActionModal (Transfer, Power Up/Down, Delegate,
//    Manage Delegations, Delegations List, Swap, Deposit, Withdraw, Profile)
// ============================================================================

export type WalletModalAction =
  | {
      kind: 'TRANSFER';
      symbol: string;
      precision?: number;
      availableBalance?: number;
      isEngine?: boolean;
      savingsMode?: 'NONE' | 'DEPOSIT' | 'WITHDRAW';
      defaultTo?: string;
      defaultMemo?: string;
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
      kind: 'MANAGE_DELEGATIONS';
      account?: string;
      initialAsset?: 'WAIV' | 'HP' | 'RC';
      initialTab?: 'WAIV' | 'HP' | 'RC';
      totalVestingShares?: string;
      totalVestingFundSteem?: string;
    }
  | {
      kind: 'DELEGATIONS_LIST';
      account: string;
      variant: 'waiv' | 'hiveHp' | 'hiveRc';
    }
  | {
      kind: 'SWAP';
      fromSymbol?: string;
      toSymbol?: string;
      initialFromSymbol?: string;
      initialToSymbol?: string;
    }
  | {
      kind: 'DEPOSIT';
      initialSymbol?: string;
    }
  | {
      kind: 'WITHDRAW';
      inputSymbol?: string;
      outputSymbol?: string;
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
  onSwitchAction,
}: {
  action: WalletModalAction | null;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchAction?: (next: WalletModalAction) => void;
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

  // Delegations List / Manage Delegations state
  const [delLoading, setDelLoading] = useState(false);
  const [delTab, setDelTab] = useState<'received' | 'delegated'>('received');
  const [manageAsset, setManageAsset] = useState<'WAIV' | 'HP' | 'RC'>('WAIV');
  const [hpDelData, setHpDelData] = useState<HiveHpDelegationsResponse | null>(null);
  const [rcDelData, setRcDelData] = useState<HiveRcDelegationsResponse | null>(null);
  const [waivDelData, setWaivDelData] = useState<EngineTokenDelegationsResponse | null>(null);

  // Swap state
  const [swapList, setSwapList] = useState<EngineSwapListResponse['tokens']>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapFrom, setSwapFrom] = useState('SWAP.HIVE');
  const [swapTo, setSwapTo] = useState('WAIV');
  const [swapAmountIn, setSwapAmountIn] = useState('');
  const [swapAmountOut, setSwapAmountOut] = useState('');
  const [swapImpact, setSwapImpact] = useState('0');
  const [swapCustomJson, setSwapCustomJson] = useState<Record<string, unknown>[]>([]);
  const [swapQuoteLoading, setSwapQuoteLoading] = useState(false);

  // Deposit state
  const [depositList, setDepositList] = useState<EngineDepositListResponse['tokens']>([]);
  const [depositSymbol, setDepositSymbol] = useState('HIVE');
  const [depositInfo, setDepositInfo] = useState<EngineDepositAddressResponse | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Withdraw state
  const [withdrawList, setWithdrawList] = useState<EngineWithdrawListResponse['tokens']>([]);
  const [withdrawInputSym, setWithdrawInputSym] = useState('WAIV');
  const [withdrawOutputSym, setWithdrawOutputSym] = useState('HIVE');
  const [withdrawQty, setWithdrawQty] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawReceive, setWithdrawReceive] = useState<number | null>(null);
  const [withdrawCustomJson, setWithdrawCustomJson] = useState<Record<string, unknown>[]>([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

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
      setMemoInput(action.defaultMemo ?? '');
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
    } else if (action.kind === 'MANAGE_DELEGATIONS') {
      setManageAsset(action.initialAsset || action.initialTab || 'WAIV');
    } else if (action.kind === 'DELEGATIONS_LIST') {
      setDelTab('received');
    } else if (action.kind === 'SWAP') {
      setSwapFrom(action.fromSymbol || action.initialFromSymbol || 'SWAP.HIVE');
      setSwapTo(action.toSymbol || action.initialToSymbol || 'WAIV');
      setSwapAmountIn('');
      setSwapAmountOut('');
      setSwapCustomJson([]);
    } else if (action.kind === 'DEPOSIT') {
      setDepositSymbol(action.initialSymbol || 'HIVE');
    } else if (action.kind === 'WITHDRAW') {
      setWithdrawInputSym(action.inputSymbol || 'WAIV');
      setWithdrawOutputSym(action.outputSymbol || 'HIVE');
      setWithdrawQty('');
      setWithdrawAddress('');
      setWithdrawReceive(null);
      setWithdrawCustomJson([]);
    }
  }, [action, username]);

  // Load Delegations when DELEGATIONS_LIST or MANAGE_DELEGATIONS is open
  useEffect(() => {
    if (!action) return;
    if (action.kind !== 'DELEGATIONS_LIST' && action.kind !== 'MANAGE_DELEGATIONS') return;
    const targetAccount =
      action.kind === 'DELEGATIONS_LIST' ? action.account : action.account || username || '';
    if (!targetAccount) return;

    let cancelled = false;
    setDelLoading(true);
    setError(null);

    async function loadDel() {
      const variant =
        action?.kind === 'DELEGATIONS_LIST'
          ? action.variant
          : manageAsset === 'HP'
            ? 'hiveHp'
            : manageAsset === 'RC'
              ? 'hiveRc'
              : 'waiv';

      if (variant === 'waiv') {
        const res = await fetchEngineTokenDelegations(targetAccount, 'WAIV');
        if (!cancelled) {
          setWaivDelData(isOk(res) ? res.value : null);
          setDelLoading(false);
        }
      } else if (variant === 'hiveRc') {
        const res = await fetchHiveRcDelegations(targetAccount);
        if (!cancelled) {
          setRcDelData(isOk(res) ? res.value : null);
          setDelLoading(false);
        }
      } else {
        const res = await fetchHiveHpDelegations(targetAccount);
        if (!cancelled) {
          setHpDelData(isOk(res) ? res.value : null);
          setDelLoading(false);
        }
      }
    }

    void loadDel();
    return () => {
      cancelled = true;
    };
  }, [action, manageAsset, username]);

  // Load Swap list when SWAP is open
  useEffect(() => {
    if (!action || action.kind !== 'SWAP' || !username) return;
    let cancelled = false;
    setSwapLoading(true);
    void fetchEngineSwapList(username).then((res) => {
      if (cancelled) return;
      setSwapLoading(false);
      if (isOk(res)) {
        setSwapList(res.value.tokens);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [action, username]);

  // Fetch Swap quote when amount/symbols change
  useEffect(() => {
    if (!action || action.kind !== 'SWAP' || !username) return;
    const amt = parseFloat(swapAmountIn);
    if (!Number.isFinite(amt) || amt <= 0 || !swapFrom || !swapTo || swapFrom === swapTo) {
      setSwapAmountOut('');
      setSwapCustomJson([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSwapQuoteLoading(true);
      void fetchEngineSwapQuote(username, {
        fromSymbol: swapFrom,
        toSymbol: swapTo,
        amountIn: swapAmountIn,
        direction: 'exactInput',
      }).then((res) => {
        if (cancelled) return;
        setSwapQuoteLoading(false);
        if (isOk(res)) {
          setSwapAmountOut(res.value.amountOut);
          setSwapImpact(res.value.priceImpact);
          setSwapCustomJson(res.value.customJson);
          setError(null);
        } else {
          setSwapAmountOut('');
          setSwapCustomJson([]);
          setError('No swap liquidity pool quote available for this pair.');
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [action, swapAmountIn, swapFrom, swapTo, username]);

  // Load Deposit list & address when DEPOSIT is open
  useEffect(() => {
    if (!action || action.kind !== 'DEPOSIT' || !username) return;
    let cancelled = false;
    setDepositLoading(true);
    void Promise.all([
      fetchEngineDepositList(username),
      fetchEngineDepositAddress(username, depositSymbol),
    ]).then(([listRes, addrRes]) => {
      if (cancelled) return;
      setDepositLoading(false);
      if (isOk(listRes)) setDepositList(listRes.value.tokens);
      if (isOk(addrRes)) setDepositInfo(addrRes.value);
    });
    return () => {
      cancelled = true;
    };
  }, [action, depositSymbol, username]);

  // Load Withdraw list when WITHDRAW is open
  useEffect(() => {
    if (!action || action.kind !== 'WITHDRAW' || !username) return;
    let cancelled = false;
    setWithdrawLoading(true);
    void fetchEngineWithdrawList(username).then((res) => {
      if (cancelled) return;
      setWithdrawLoading(false);
      if (isOk(res)) {
        setWithdrawList(res.value.tokens);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [action, username]);

  // Fetch Withdraw quote when quantity/pair changes
  useEffect(() => {
    if (!action || action.kind !== 'WITHDRAW' || !username) return;
    const qty = parseFloat(withdrawQty);
    if (!Number.isFinite(qty) || qty <= 0 || !withdrawInputSym || !withdrawOutputSym) {
      setWithdrawReceive(null);
      setWithdrawCustomJson([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchEngineWithdrawQuote(username, {
        inputSymbol: withdrawInputSym,
        outputSymbol: withdrawOutputSym,
        quantity: withdrawQty,
        address: withdrawAddress.trim() || username,
        previewOnly: !withdrawAddress.trim() && withdrawOutputSym !== 'HIVE' && withdrawOutputSym !== 'HBD',
      }).then((res) => {
        if (cancelled) return;
        if (isOk(res)) {
          setWithdrawReceive(res.value.predictiveAmount);
          setWithdrawCustomJson(res.value.customJsonPayload);
          if (res.value.error) setError(res.value.error);
          else setError(null);
        }
      });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [action, username, withdrawAddress, withdrawInputSym, withdrawOutputSym, withdrawQty]);

  const copyText = useCallback(async (label: string, val: string | null | undefined) => {
    if (!val) return;
    await navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  }, []);

  const selectedSwapFromToken = useMemo(
    () => swapList.find((t) => t.symbol === swapFrom) ?? null,
    [swapFrom, swapList],
  );

  if (!action) return null;

  const maxAmount =
    action.kind === 'TRANSFER' || action.kind === 'POWER_UP'
      ? action.availableBalance ?? 0
      : action.kind === 'POWER_DOWN' || action.kind === 'DELEGATE'
        ? action.availableStaked ?? 0
        : 0;

  const precision =
    action.kind === 'TRANSFER' ||
    action.kind === 'POWER_UP' ||
    action.kind === 'POWER_DOWN' ||
    action.kind === 'DELEGATE'
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
      } else if (action.kind === 'SWAP') {
        if (swapCustomJson.length === 0) {
          throw new Error('Please enter a valid swap amount and wait for the pool quote.');
        }
        ops = [
          buildCustomJsonOp({
            required_auths: [username],
            required_posting_auths: [],
            id: 'ssc-mainnet-hive',
            json: JSON.stringify(
              swapCustomJson.length === 1 ? swapCustomJson[0] : swapCustomJson,
            ),
          }),
        ];
      } else if (action.kind === 'WITHDRAW') {
        if (withdrawCustomJson.length === 0) {
          throw new Error('Please enter a valid withdrawal quantity and destination.');
        }
        ops = [
          buildCustomJsonOp({
            required_auths: [username],
            required_posting_auths: [],
            id: 'ssc-mainnet-hive',
            json: JSON.stringify(
              withdrawCustomJson.length === 1 ? withdrawCustomJson[0] : withdrawCustomJson,
            ),
          }),
        ];
      } else if (
        action.kind === 'TRANSFER' ||
        action.kind === 'POWER_UP' ||
        action.kind === 'POWER_DOWN' ||
        action.kind === 'DELEGATE'
      ) {
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

  // --- Read-Only Delegations List Modal (`WalletDelegationsListModal` parity) ---
  if (action.kind === 'DELEGATIONS_LIST') {
    const title =
      action.variant === 'waiv'
        ? 'WAIV Power Delegations'
        : action.variant === 'hiveRc'
          ? 'Resource Credits Delegations'
          : 'HIVE Power Delegations';
    const unit = action.variant === 'waiv' ? 'WP' : action.variant === 'hiveRc' ? 'b RC' : 'HP';

    const receivedRows =
      action.variant === 'waiv'
        ? (waivDelData?.incoming ?? []).map((r) => ({ user: r.from, qty: r.quantity }))
        : action.variant === 'hiveRc'
          ? (rcDelData?.incoming ?? []).map((r) => ({
              user: r.from,
              qty: (Number(r.delegatedRc) / 1e9).toFixed(2),
            }))
          : (hpDelData?.incoming ?? []).map((r) => ({ user: r.delegator, qty: r.hp }));

    const delegatedRows =
      action.variant === 'waiv'
        ? (waivDelData?.outgoing ?? []).map((r) => ({ user: r.to, qty: r.quantity }))
        : action.variant === 'hiveRc'
          ? (rcDelData?.outgoing ?? []).map((r) => ({
              user: r.to,
              qty: (Number(r.delegatedRc) / 1e9).toFixed(2),
            }))
          : (hpDelData?.outgoing ?? []).map((r) => ({ user: r.delegatee, qty: r.hp }));

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[80dvh] w-full max-w-[480px] flex-col rounded-[8px] border border-[#e9e7e7] bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#e9e7e7] pb-3">
            <h3 className="text-[17px] font-bold text-[#333333]">
              {title} (@{action.account})
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-[18px] text-[#99aab5] hover:text-[#333333]"
            >
              ✕
            </button>
          </div>

          <div className="mb-3 flex gap-6 border-b border-[#e9e7e7]">
            <button
              type="button"
              onClick={() => setDelTab('received')}
              className={`cursor-pointer border-b-2 pb-2 text-[14px] font-medium ${
                delTab === 'received'
                  ? 'border-[#af3d36] text-[#af3d36]'
                  : 'border-transparent text-[#99aab5] hover:text-[#333333]'
              }`}
            >
              Received ({receivedRows.length})
            </button>
            <button
              type="button"
              onClick={() => setDelTab('delegated')}
              className={`cursor-pointer border-b-2 pb-2 text-[14px] font-medium ${
                delTab === 'delegated'
                  ? 'border-[#af3d36] text-[#af3d36]'
                  : 'border-transparent text-[#99aab5] hover:text-[#333333]'
              }`}
            >
              Delegated ({delegatedRows.length})
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {delLoading ? (
              <p className="py-6 text-center text-[14px] text-[#99aab5]">Loading delegations...</p>
            ) : (delTab === 'received' ? receivedRows : delegatedRows).length === 0 ? (
              <p className="py-6 text-center text-[14px] text-[#99aab5]">No delegations found.</p>
            ) : (
              <ul className="divide-y divide-[#e9e7e7]">
                {(delTab === 'received' ? receivedRows : delegatedRows).map((row) => (
                  <li key={row.user} className="flex items-center justify-between py-2.5">
                    <Link
                      href={`/@${encodeURIComponent(row.user)}`}
                      onClick={onClose}
                      className="flex items-center gap-2.5 font-medium text-[#333333] hover:text-[#af3d36]"
                    >
                      <img
                        src={`https://images.hive.blog/u/${row.user}/avatar/small`}
                        alt={row.user}
                        className="h-8 w-8 rounded-full border border-[#e9e7e7] object-cover"
                      />
                      <span>@{row.user}</span>
                    </Link>
                    <span className="font-mono text-[14px] font-semibold text-[#333333]">
                      {row.qty} {unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full cursor-pointer rounded-[24px] border border-[#e9e7e7] py-2 text-[14px] font-medium text-[#333333] hover:bg-[#f5f6f7]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // --- Manage Delegations Modal (`WalletManageDelegationsModal` parity) ---
  if (action.kind === 'MANAGE_DELEGATIONS') {
    const unit = manageAsset === 'WAIV' ? 'WP' : manageAsset === 'RC' ? 'b RC' : 'HP';
    const outgoingRows =
      manageAsset === 'WAIV'
        ? (waivDelData?.outgoing ?? []).map((r) => ({ user: r.to, qty: r.quantity }))
        : manageAsset === 'RC'
          ? (rcDelData?.outgoing ?? []).map((r) => ({
              user: r.to,
              qty: (Number(r.delegatedRc) / 1e9).toFixed(2),
            }))
          : (hpDelData?.outgoing ?? []).map((r) => ({ user: r.delegatee, qty: r.hp }));

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="flex max-h-[82dvh] w-full max-w-[480px] flex-col rounded-[8px] border border-[#e9e7e7] bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between border-b border-[#e9e7e7] pb-3">
            <h3 className="text-[17px] font-bold text-[#333333]">Manage delegations</h3>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-[18px] text-[#99aab5] hover:text-[#333333]"
            >
              ✕
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <select
              value={manageAsset}
              onChange={(e) => setManageAsset(e.target.value as 'WAIV' | 'HP' | 'RC')}
              className="flex-1 rounded-[24px] border border-[#e9e7e7] bg-[#fafafa] px-3.5 py-2 text-[14px] font-medium text-[#333333] outline-none focus:border-[#af3d36]"
            >
              <option value="WAIV">WAIV Power (WP)</option>
              <option value="HP">HIVE Power (HP)</option>
              <option value="RC">Resource Credits (RC)</option>
            </select>
            <button
              type="button"
              onClick={() =>
                onSwitchAction?.({
                  kind: 'DELEGATE',
                  symbol: manageAsset,
                  precision: manageAsset === 'WAIV' ? 8 : 3,
                  isEngine: manageAsset === 'WAIV',
                  totalVestingShares: action.totalVestingShares,
                  totalVestingFundSteem: action.totalVestingFundSteem,
                })
              }
              className="cursor-pointer rounded-[24px] bg-[#af3d36] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#93312b]"
            >
              + New Delegation
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {delLoading ? (
              <p className="py-6 text-center text-[14px] text-[#99aab5]">Loading outgoing delegations...</p>
            ) : outgoingRows.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-[#99aab5]">
                No active outgoing {unit} delegations.
              </p>
            ) : (
              <ul className="divide-y divide-[#e9e7e7]">
                {outgoingRows.map((row) => (
                  <li key={row.user} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={`https://images.hive.blog/u/${row.user}/avatar/small`}
                        alt={row.user}
                        className="h-8 w-8 rounded-full border border-[#e9e7e7] object-cover"
                      />
                      <div>
                        <p className="text-[14px] font-medium text-[#333333]">@{row.user}</p>
                        <p className="font-mono text-[12px] text-[#99aab5]">
                          {row.qty} {unit}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSwitchAction?.({
                          kind: 'DELEGATE',
                          symbol: manageAsset,
                          precision: manageAsset === 'WAIV' ? 8 : 3,
                          isEngine: manageAsset === 'WAIV',
                          defaultTo: row.user,
                          totalVestingShares: action.totalVestingShares,
                          totalVestingFundSteem: action.totalVestingFundSteem,
                        })
                      }
                      className="cursor-pointer rounded-[24px] border border-[#af3d36] px-3 py-1 text-[12px] font-medium text-[#af3d36] hover:bg-[#af3d36]/10"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full cursor-pointer rounded-[24px] border border-[#e9e7e7] py-2 text-[14px] font-medium text-[#333333] hover:bg-[#f5f6f7]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // --- Deposit Modal (`WalletDepositModal` parity) ---
  if (action.kind === 'DEPOSIT') {
    const swapSymbol =
      depositList.find((t) => t.symbol === depositSymbol)?.swapSymbol ?? `SWAP.${depositSymbol}`;
    const isHiveOrHbd = depositSymbol === 'HIVE' || depositSymbol === 'HBD';

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[460px] rounded-[8px] border border-[#e9e7e7] bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between border-b border-[#e9e7e7] pb-3">
            <h3 className="text-[17px] font-bold text-[#333333]">Deposit to Hive Engine</h3>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-[18px] text-[#99aab5] hover:text-[#333333]"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#595959]">Select Token</label>
              <select
                value={depositSymbol}
                onChange={(e) => setDepositSymbol(e.target.value)}
                className="w-full rounded-[8px] border border-[#d9d9d9] bg-[#fafafa] px-3 py-2 text-[14px] font-medium text-[#333333] outline-none focus:border-[#af3d36]"
              >
                {(depositList.length > 0
                  ? depositList
                  : [
                      { symbol: 'HIVE', displayName: 'HIVE', swapSymbol: 'SWAP.HIVE', pairLabel: 'HIVE → SWAP.HIVE' },
                      { symbol: 'HBD', displayName: 'HBD', swapSymbol: 'SWAP.HBD', pairLabel: 'HBD → SWAP.HBD' },
                      { symbol: 'BTC', displayName: 'Bitcoin', swapSymbol: 'SWAP.BTC', pairLabel: 'BTC → SWAP.BTC' },
                      { symbol: 'LTC', displayName: 'Litecoin', swapSymbol: 'SWAP.LTC', pairLabel: 'LTC → SWAP.LTC' },
                      { symbol: 'ETH', displayName: 'Ethereum', swapSymbol: 'SWAP.ETH', pairLabel: 'ETH → SWAP.ETH' },
                    ]
                ).map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} → {t.swapSymbol}
                  </option>
                ))}
              </select>
            </div>

            {depositLoading ? (
              <p className="py-4 text-center text-[13px] text-[#99aab5]">Loading deposit routing...</p>
            ) : depositInfo ? (
              <div className="space-y-3 rounded-[8px] border border-[#e9e7e7] bg-[#fafafa] p-3.5 text-[13px]">
                <p className="text-[#595959]">
                  Send <strong>{depositSymbol}</strong> using the details below. Confirmed deposits are credited as{' '}
                  <strong>{swapSymbol}</strong> to <strong>@{username}</strong>.
                </p>

                {depositInfo.account ? (
                  <div>
                    <div className="flex items-center justify-between text-[12px] text-[#99aab5]">
                      <span>Deposit Account</span>
                      <button
                        type="button"
                        onClick={() => void copyText('account', depositInfo.account)}
                        className="cursor-pointer font-semibold text-[#af3d36] hover:underline"
                      >
                        {copiedField === 'account' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-0.5 font-mono font-semibold text-[#333333]">
                      @{depositInfo.account}
                    </p>
                  </div>
                ) : null}

                {depositInfo.memo ? (
                  <div>
                    <div className="flex items-center justify-between text-[12px] text-[#99aab5]">
                      <span>Memo (Required)</span>
                      <button
                        type="button"
                        onClick={() => void copyText('memo', depositInfo.memo)}
                        className="cursor-pointer font-semibold text-[#af3d36] hover:underline"
                      >
                        {copiedField === 'memo' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-0.5 break-all rounded border border-[#e9e7e7] bg-white p-2 font-mono text-[12px] text-[#333333]">
                      {depositInfo.memo}
                    </p>
                  </div>
                ) : null}

                {depositInfo.address ? (
                  <div>
                    <div className="flex items-center justify-between text-[12px] text-[#99aab5]">
                      <span>Deposit Address</span>
                      <button
                        type="button"
                        onClick={() => void copyText('address', depositInfo.address)}
                        className="cursor-pointer font-semibold text-[#af3d36] hover:underline"
                      >
                        {copiedField === 'address' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="mt-0.5 break-all rounded border border-[#e9e7e7] bg-white p-2 font-mono text-[12px] text-[#333333]">
                      {depositInfo.address}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-[24px] border border-[#d9d9d9] px-4 py-2 text-[13px] font-medium text-[#595959] hover:bg-[#f5f6f7]"
              >
                Close
              </button>
              {isHiveOrHbd && depositInfo?.account && depositInfo?.memo ? (
                <button
                  type="button"
                  onClick={() =>
                    onSwitchAction?.({
                      kind: 'TRANSFER',
                      symbol: depositSymbol,
                      precision: 3,
                      isEngine: false,
                      defaultTo: depositInfo.account || 'honey-swap',
                      defaultMemo: depositInfo.memo || '',
                    })
                  }
                  className="cursor-pointer rounded-[24px] bg-[#af3d36] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#93312b]"
                >
                  Continue to Transfer →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const modalTitle =
    action.kind === 'EDIT_PROFILE'
      ? 'Edit Hive Profile'
      : action.kind === 'SWAP'
        ? 'Swap Tokens (Hive Engine)'
        : action.kind === 'WITHDRAW'
          ? 'Withdraw Tokens'
          : action.kind === 'TRANSFER'
            ? action.savingsMode === 'DEPOSIT'
              ? `Deposit ${action.symbol} to Savings`
              : action.savingsMode === 'WITHDRAW'
                ? `Withdraw ${action.symbol} from Savings (3-Day Unbonding)`
                : `Transfer ${action.symbol}`
            : action.kind === 'POWER_UP'
              ? `Power Up ${action.symbol}`
              : action.kind === 'POWER_DOWN'
                ? `Power Down ${action.symbol}`
                : `Delegate ${action.symbol}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[8px] border border-[#e0e0e0] bg-white p-5 shadow-xl"
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
                className="cursor-pointer rounded-[24px] bg-[#af3d36] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#96322c]"
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
            ) : action.kind === 'SWAP' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">From</label>
                    <select
                      value={swapFrom}
                      onChange={(e) => setSwapFrom(e.target.value)}
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36]"
                    >
                      {(swapList.length > 0
                        ? swapList
                        : [
                            { symbol: 'SWAP.HIVE', balance: '0', name: 'SWAP.HIVE', precision: 8, iconUrl: null, pairs: [] },
                            { symbol: 'WAIV', balance: '0', name: 'WAIV', precision: 8, iconUrl: null, pairs: [] },
                          ]
                      ).map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol} ({t.balance})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">To</label>
                    <input
                      type="text"
                      value={swapTo}
                      onChange={(e) => setSwapTo(e.target.value.toUpperCase())}
                      placeholder="WAIV"
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[12px] font-bold text-[#595959]">
                      Amount ({swapFrom})
                    </label>
                    {selectedSwapFromToken ? (
                      <button
                        type="button"
                        onClick={() => setSwapAmountIn(selectedSwapFromToken.balance)}
                        className="cursor-pointer text-[11px] font-bold text-[#af3d36] hover:underline"
                      >
                        Balance: {selectedSwapFromToken.balance}
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={swapAmountIn}
                    onChange={(e) => setSwapAmountIn(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[14px] font-semibold text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>

                <div className="rounded bg-[#f9fafb] p-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#595959]">Estimated Output ({swapTo}):</span>
                    <span className="font-mono font-bold text-[#303540]">
                      {swapQuoteLoading
                        ? 'Calculating...'
                        : swapAmountOut
                          ? `${swapAmountOut} ${swapTo}`
                          : '—'}
                    </span>
                  </div>
                  {swapAmountOut ? (
                    <div className="mt-1 flex items-center justify-between text-[12px] text-[#99aab5]">
                      <span>Price Impact:</span>
                      <span>{swapImpact}%</span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : action.kind === 'WITHDRAW' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      From Token
                    </label>
                    <input
                      type="text"
                      value={withdrawInputSym}
                      onChange={(e) => setWithdrawInputSym(e.target.value.toUpperCase())}
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Receive Network
                    </label>
                    <select
                      value={withdrawOutputSym}
                      onChange={(e) => setWithdrawOutputSym(e.target.value)}
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36]"
                    >
                      <option value="HIVE">HIVE</option>
                      <option value="HBD">HBD</option>
                      <option value="BTC">BTC</option>
                      <option value="LTC">LTC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                    Quantity ({withdrawInputSym})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={withdrawQty}
                    onChange={(e) => setWithdrawQty(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[14px] font-semibold text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                </div>

                {withdrawOutputSym !== 'HIVE' && withdrawOutputSym !== 'HBD' ? (
                  <div>
                    <label className="mb-1 block text-[12px] font-bold text-[#595959]">
                      Destination {withdrawOutputSym} Address
                    </label>
                    <input
                      type="text"
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      placeholder={`Enter ${withdrawOutputSym} wallet address`}
                      className="w-full rounded border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                    />
                  </div>
                ) : null}

                {withdrawReceive !== null ? (
                  <div className="rounded bg-[#f9fafb] p-3 text-[13px]">
                    Estimated Receive:{' '}
                    <strong className="font-mono">
                      {withdrawReceive} {withdrawOutputSym}
                    </strong>
                  </div>
                ) : null}
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
                ) : (
                  <p className="rounded bg-[#f9fafb] p-2.5 text-[12px] text-[#595959]">
                    {action.symbol === 'WAIV'
                      ? 'WAIV Power unstakes in 4 equal weekly payments.'
                      : 'HIVE Power powers down in 13 equal weekly payments.'}
                  </p>
                )}

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
                className="cursor-pointer rounded-[24px] border border-[#d9d9d9] bg-white px-4 py-2 text-[13px] font-medium text-[#595959] hover:bg-[#f5f5f5]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="cursor-pointer rounded-[24px] bg-[#af3d36] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#96322c] disabled:opacity-50"
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
