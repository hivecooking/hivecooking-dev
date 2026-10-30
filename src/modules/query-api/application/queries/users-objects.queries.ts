import {
  discoverObjectsResponseSchema,
  engineWalletResponseSchema,
  paginatedFeedPostsSchema,
  paginatedUserFollowListSchema,
  resolveNestedResponseSchema,
  resolveObjectResponseSchema,
  userAccountSidebarSchema,
  userActivityResponseSchema,
  userAuthorityListResponseSchema,
  userBlogObjectFiltersSchema,
  userCategoriesResponseSchema,
  userExpertiseCountersResponseSchema,
  userExpertiseObjectsResponseSchema,
  userFavoritesListResponseSchema,
  userFavoritesTypesResponseSchema,
  userFollowingObjectsResponseSchema,
  userProfileSchema,
  userShopFiltersResponseSchema,
  userShopObjectsResponseSchema,
  userShopSectionsResponseSchema,
  walletHistoryResponseSchema,
  type DiscoverObjectsResponse,
  type EngineWalletResponse,
  type PaginatedFeedPosts,
  type PaginatedUserFollowList,
  type UserAccountSidebar,
  type UserActivityResponse,
  type UserAuthorityListResponse,
  type UserBlogObjectFilters,
  type UserCategoriesResponse,
  type UserExpertiseCountersResponse,
  type UserExpertiseObjectsResponse,
  type UserFavoritesListResponse,
  type UserFavoritesTypesResponse,
  type UserFollowingObjectsResponse,
  type UserProfile,
  type UserShopFiltersResponse,
  type UserShopObjectsResponse,
  type UserShopSectionsResponse,
  type WalletHistoryResponse,
} from '../../domain/api-responses.schema';
import { queryApiFetch } from '../../infrastructure/query-api.client';

export async function fetchUserProfile(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserProfile>(`/users/${encoded}/profile`, userProfileSchema, {
    signal,
  });
}

export async function fetchUserAccountSidebar(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserAccountSidebar>(
    `/users/${encoded}/account-sidebar`,
    userAccountSidebarSchema,
    { signal },
  );
}

export async function fetchUserBlog(
  name: string,
  body: { limit?: number; cursor?: string; currency?: string; object_ids?: string[] } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedFeedPosts>(`/users/${encoded}/blog`, paginatedFeedPostsSchema, {
    method: 'POST',
    body: {
      limit: body.limit ?? 15,
      cursor: body.cursor,
      currency: body.currency ?? 'USD',
      object_ids: body.object_ids,
    },
    signal,
  });
}

export async function fetchUserBlogObjectFilters(
  name: string,
  objects: string[] = [],
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserBlogObjectFilters>(
    `/users/${encoded}/blog/object-filters`,
    userBlogObjectFiltersSchema,
    {
      method: 'POST',
      body: { objects },
      signal,
    },
  );
}

export async function fetchUserThreads(
  name: string,
  body: { limit?: number; cursor?: string; sort?: string; currency?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedFeedPosts>(`/users/${encoded}/threads`, paginatedFeedPostsSchema, {
    method: 'POST',
    body: {
      limit: body.limit ?? 20,
      cursor: body.cursor,
      sort: body.sort ?? 'latest',
      currency: body.currency ?? 'USD',
    },
    signal,
  });
}

export async function fetchUserComments(
  name: string,
  body: { limit?: number; cursor?: string; sort?: string; currency?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedFeedPosts>(`/users/${encoded}/comments`, paginatedFeedPostsSchema, {
    method: 'POST',
    body: {
      limit: body.limit ?? 20,
      cursor: body.cursor,
      sort: body.sort ?? 'latest',
      currency: body.currency ?? 'USD',
    },
    signal,
  });
}

export async function fetchUserMentions(
  name: string,
  body: { limit?: number; cursor?: string; currency?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedFeedPosts>(`/users/${encoded}/mentions`, paginatedFeedPostsSchema, {
    method: 'POST',
    body: {
      limit: body.limit ?? 20,
      cursor: body.cursor,
      currency: body.currency ?? 'USD',
    },
    signal,
  });
}

export async function fetchUserActivity(
  name: string,
  body: { limit?: number; cursor?: string; filters?: string[] } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserActivityResponse>(
    `/users/${encoded}/activity`,
    userActivityResponseSchema,
    {
      method: 'POST',
      body: {
        limit: body.limit ?? 20,
        cursor: body.cursor,
        filters: body.filters ?? [],
      },
      signal,
    },
  );
}

export async function fetchUserFollowers(
  name: string,
  query: { sort?: string; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedUserFollowList>(
    `/users/${encoded}/followers`,
    paginatedUserFollowListSchema,
    {
      query: {
        sort: query.sort ?? 'recency',
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function fetchUserFollowing(
  name: string,
  query: { sort?: string; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedUserFollowList>(
    `/users/${encoded}/following`,
    paginatedUserFollowListSchema,
    {
      query: {
        sort: query.sort ?? 'recency',
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function fetchUserFollowingObjects(
  name: string,
  query: { sort?: string; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserFollowingObjectsResponse>(
    `/users/${encoded}/following-objects`,
    userFollowingObjectsResponseSchema,
    {
      query: {
        sort: query.sort ?? 'weight',
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function fetchUserFavoritesTypes(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserFavoritesTypesResponse>(
    `/users/${encoded}/favorites/types`,
    userFavoritesTypesResponseSchema,
    { signal },
  );
}

export async function fetchUserFavorites(
  name: string,
  query: { objectType: string; skip?: number; limit?: number } = { objectType: '' },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserFavoritesListResponse>(
    `/users/${encoded}/favorites`,
    userFavoritesListResponseSchema,
    {
      query: {
        objectType: query.objectType,
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function fetchUserExpertiseCounters(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserExpertiseCountersResponse>(
    `/users/${encoded}/expertise/counters`,
    userExpertiseCountersResponseSchema,
    { signal },
  );
}

export async function fetchUserExpertiseObjects(
  name: string,
  query: { scope?: 'hashtags' | 'objects'; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserExpertiseObjectsResponse>(
    `/users/${encoded}/expertise`,
    userExpertiseObjectsResponseSchema,
    {
      query: {
        scope: query.scope ?? 'hashtags',
        skip: query.skip ?? 0,
        limit: query.limit ?? 30,
      },
      signal,
    },
  );
}

export async function fetchUserCategories(
  name: string,
  body: { types: string[]; name?: string; path?: string[] },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserCategoriesResponse>(
    `/users/${encoded}/categories`,
    userCategoriesResponseSchema,
    {
      method: 'POST',
      body,
      signal,
    },
  );
}

export async function fetchUserShopFilters(
  name: string,
  body: {
    types: string[];
    categoryPath?: string[];
    uncategorizedOnly?: boolean;
    tags?: string[];
    rating?: number | null;
  },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserShopFiltersResponse>(
    `/users/${encoded}/shop/filters`,
    userShopFiltersResponseSchema,
    {
      method: 'POST',
      body: {
        types: body.types,
        categoryPath: body.categoryPath,
        uncategorizedOnly: body.uncategorizedOnly,
        tags: body.tags,
        rating: body.rating ?? undefined,
      },
      signal,
    },
  );
}

export async function fetchUserShopSections(
  name: string,
  body: {
    types: string[];
    name?: string;
    path?: string[];
    tags?: string[];
    rating?: number | null;
    cursor?: string;
    sectionLimit?: number;
  },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserShopSectionsResponse>(
    `/users/${encoded}/shop/sections`,
    userShopSectionsResponseSchema,
    {
      method: 'POST',
      body: {
        types: body.types,
        name: body.name,
        path: body.path,
        tags: body.tags,
        rating: body.rating ?? undefined,
        cursor: body.cursor,
        sectionLimit: body.sectionLimit ?? 3,
      },
      signal,
    },
  );
}

export async function fetchUserShopObjects(
  name: string,
  body: {
    types: string[];
    categoryPath?: string[];
    uncategorizedOnly?: boolean;
    tags?: string[];
    rating?: number | null;
    limit?: number;
    cursor?: string;
  },
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserShopObjectsResponse>(
    `/users/${encoded}/shop/objects`,
    userShopObjectsResponseSchema,
    {
      method: 'POST',
      body: {
        types: body.types,
        categoryPath: body.categoryPath,
        uncategorizedOnly: body.uncategorizedOnly,
        tags: body.tags,
        rating: body.rating ?? undefined,
        limit: body.limit ?? 20,
        cursor: body.cursor,
      },
      signal,
    },
  );
}

export async function fetchEngineWallet(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<EngineWalletResponse>(
    `/users/${encoded}/wallet/engine`,
    engineWalletResponseSchema,
    { signal },
  );
}

export async function fetchWaivWalletHistory(
  name: string,
  query: { limit?: number; cursor?: string; showRewards?: boolean } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<WalletHistoryResponse>(
    `/users/${encoded}/wallet/waiv/history`,
    walletHistoryResponseSchema,
    {
      query: {
        limit: query.limit ?? 20,
        cursor: query.cursor,
        showRewards: query.showRewards,
      },
      signal,
    },
  );
}

export async function fetchEngineWalletHistory(
  name: string,
  query: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<WalletHistoryResponse>(
    `/users/${encoded}/wallet/engine/history`,
    walletHistoryResponseSchema,
    {
      query: {
        limit: query.limit ?? 20,
        cursor: query.cursor,
      },
      signal,
    },
  );
}

export async function fetchUserAuthorityGrantors(
  name: string,
  query: { type?: string; sort?: string; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserAuthorityListResponse>(
    `/users/${encoded}/authority/grantors`,
    userAuthorityListResponseSchema,
    {
      query: {
        type: query.type,
        sort: query.sort ?? 'a-z',
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function fetchUserAuthorityGrantees(
  name: string,
  query: { type?: string; sort?: string; skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserAuthorityListResponse>(
    `/users/${encoded}/authority/grantees`,
    userAuthorityListResponseSchema,
    {
      query: {
        type: query.type,
        sort: query.sort ?? 'a-z',
        skip: query.skip ?? 0,
        limit: query.limit ?? 20,
      },
      signal,
    },
  );
}

export async function resolveObject(
  body: { object_id: string; update_types?: string[]; include_rejected?: boolean },
  signal?: AbortSignal,
) {
  return queryApiFetch(`/objects/resolve`, resolveObjectResponseSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function resolveObjectsNested(
  body: { ids: string[]; update_types?: string[] },
  signal?: AbortSignal,
) {
  return queryApiFetch('/objects/resolve-nested', resolveNestedResponseSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function fetchObjectFollowers(
  objectId: string,
  query: { skip?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(objectId);
  return queryApiFetch(`/objects/${encoded}/followers`, paginatedUserFollowListSchema, {
    query: {
      skip: query.skip ?? 0,
      limit: query.limit ?? 20,
    },
    signal,
  });
}

export async function fetchObjectPosts(
  objectId: string,
  body: { limit?: number; cursor?: string; currency?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(objectId);
  return queryApiFetch<PaginatedFeedPosts>(
    `/objects/${encoded}/posts`,
    paginatedFeedPostsSchema,
    {
      method: 'POST',
      body: {
        limit: body.limit ?? 15,
        cursor: body.cursor,
        currency: body.currency ?? 'USD',
      },
      signal,
    },
  );
}

export async function fetchObjectSimilar(
  objectId: string,
  body: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(objectId);
  return queryApiFetch<DiscoverObjectsResponse>(
    `/objects/${encoded}/similar`,
    discoverObjectsResponseSchema,
    {
      method: 'POST',
      body: {
        limit: body.limit ?? 5,
        cursor: body.cursor,
      },
      signal,
    },
  );
}

export async function fetchObjectRelated(
  objectId: string,
  body: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(objectId);
  return queryApiFetch<DiscoverObjectsResponse>(
    `/objects/${encoded}/related`,
    discoverObjectsResponseSchema,
    {
      method: 'POST',
      body: {
        limit: body.limit ?? 5,
        cursor: body.cursor,
      },
      signal,
    },
  );
}
