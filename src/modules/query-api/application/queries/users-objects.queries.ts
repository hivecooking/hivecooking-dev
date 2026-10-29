import {
  paginatedFeedPostsSchema,
  paginatedUserFollowListSchema,
  resolveNestedResponseSchema,
  resolveObjectResponseSchema,
  userProfileSchema,
  type PaginatedFeedPosts,
  type UserProfile,
} from '../../domain/api-responses.schema';
import { queryApiFetch } from '../../infrastructure/query-api.client';

export async function fetchUserProfile(name: string, signal?: AbortSignal) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<UserProfile>(`/users/${encoded}/profile`, userProfileSchema, {
    signal,
  });
}

export async function fetchUserBlog(
  name: string,
  body: { limit?: number; cursor?: string; currency?: string } = {},
  signal?: AbortSignal,
) {
  const encoded = encodeURIComponent(name);
  return queryApiFetch<PaginatedFeedPosts>(`/users/${encoded}/blog`, paginatedFeedPostsSchema, {
    method: 'POST',
    body: {
      limit: body.limit ?? 15,
      cursor: body.cursor,
      currency: body.currency ?? 'USD',
    },
    signal,
  });
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
