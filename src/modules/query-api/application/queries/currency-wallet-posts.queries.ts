import {
  currencyMarketResponseSchema,
  engineDepositAddressResponseSchema,
  engineDepositListResponseSchema,
  engineSwapListResponseSchema,
  engineSwapQuoteResponseSchema,
  engineTokenDelegationsResponseSchema,
  engineWithdrawListResponseSchema,
  engineWithdrawQuoteResponseSchema,
  hiveHpDelegationsResponseSchema,
  hiveRcDelegationsResponseSchema,
  hiveWalletResponseSchema,
  postDiscussionResponseSchema,
  singlePostSchema,
  waivWalletResponseSchema,
  type CurrencyMarketResponse,
  type EngineDepositAddressResponse,
  type EngineDepositListResponse,
  type EngineSwapListResponse,
  type EngineSwapQuoteResponse,
  type EngineTokenDelegationsResponse,
  type EngineWithdrawListResponse,
  type EngineWithdrawQuoteResponse,
  type HiveHpDelegationsResponse,
  type HiveRcDelegationsResponse,
  type HiveWalletResponse,
  type PostDiscussionResponse,
  type SinglePost,
  type WaivWalletResponse,
} from '../../domain/api-responses.schema';
import { queryApiFetch } from '../../infrastructure/query-api.client';

export async function fetchCurrencyMarket(signal?: AbortSignal) {
  return queryApiFetch<CurrencyMarketResponse>('/currency/market', currencyMarketResponseSchema, {
    signal,
  });
}

export async function fetchWaivWallet(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<WaivWalletResponse>(
    `/users/${encoded}/wallet/waiv`,
    waivWalletResponseSchema,
    { signal },
  );
}

export async function fetchHiveWallet(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<HiveWalletResponse>(
    `/users/${encoded}/wallet/hive`,
    hiveWalletResponseSchema,
    { signal },
  );
}

export async function fetchHiveHpDelegations(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<HiveHpDelegationsResponse>(
    `/users/${encoded}/wallet/hive/delegations`,
    hiveHpDelegationsResponseSchema,
    { signal },
  );
}

export async function fetchHiveRcDelegations(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<HiveRcDelegationsResponse>(
    `/users/${encoded}/wallet/hive/rc-delegations`,
    hiveRcDelegationsResponseSchema,
    { signal },
  );
}

export async function fetchEngineTokenDelegations(
  name: string,
  symbol = 'WAIV',
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineTokenDelegationsResponse>(
    `/users/${encoded}/wallet/engine/delegations`,
    engineTokenDelegationsResponseSchema,
    { query: { symbol }, signal },
  );
}

export async function fetchEngineSwapList(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineSwapListResponse>(
    `/users/${encoded}/wallet/engine/swap/list`,
    engineSwapListResponseSchema,
    { signal },
  );
}

export async function fetchEngineSwapQuote(
  name: string,
  body: {
    fromSymbol: string;
    toSymbol: string;
    amountIn: string;
    direction?: 'exactInput' | 'exactOutput';
    slippage?: number;
  },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineSwapQuoteResponse>(
    `/users/${encoded}/wallet/engine/swap/quote`,
    engineSwapQuoteResponseSchema,
    { method: 'POST', body, signal },
  );
}

export async function fetchEngineDepositList(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineDepositListResponse>(
    `/users/${encoded}/wallet/engine/deposit/list`,
    engineDepositListResponseSchema,
    { signal },
  );
}

export async function fetchEngineDepositAddress(
  name: string,
  symbol: string,
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineDepositAddressResponse>(
    `/users/${encoded}/wallet/engine/deposit/address`,
    engineDepositAddressResponseSchema,
    { query: { symbol }, signal },
  );
}

export async function fetchEngineWithdrawList(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineWithdrawListResponse>(
    `/users/${encoded}/wallet/engine/withdraw/list`,
    engineWithdrawListResponseSchema,
    { signal },
  );
}

export async function fetchEngineWithdrawQuote(
  name: string,
  body: {
    inputSymbol: string;
    outputSymbol: string;
    quantity: string;
    address?: string;
    previewOnly?: boolean;
  },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineWithdrawQuoteResponse>(
    `/users/${encoded}/wallet/engine/withdraw/quote`,
    engineWithdrawQuoteResponseSchema,
    { method: 'POST', body, signal },
  );
}

export async function fetchSinglePost(
  author: string,
  permlink: string,
  currency = 'USD',
  signal?: AbortSignal,
) {
  const encodedAuthor = encodeURIComponent(author);
  const encodedPermlink = encodeURIComponent(permlink);
  return queryApiFetch<SinglePost>(
    `/posts/${encodedAuthor}/${encodedPermlink}`,
    singlePostSchema,
    {
      query: { currency },
      signal,
    },
  );
}

export async function fetchPostDiscussion(
  author: string,
  permlink: string,
  currency = 'USD',
  signal?: AbortSignal,
) {
  const encodedAuthor = encodeURIComponent(author);
  const encodedPermlink = encodeURIComponent(permlink);
  return queryApiFetch<PostDiscussionResponse>(
    `/posts/${encodedAuthor}/${encodedPermlink}/discussion`,
    postDiscussionResponseSchema,
    {
      query: { currency },
      signal,
    },
  );
}
