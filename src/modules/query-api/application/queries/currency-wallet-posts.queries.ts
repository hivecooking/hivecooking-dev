import {
  currencyMarketResponseSchema,
  hiveWalletResponseSchema,
  postDiscussionResponseSchema,
  singlePostSchema,
  waivWalletResponseSchema,
  type CurrencyMarketResponse,
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
