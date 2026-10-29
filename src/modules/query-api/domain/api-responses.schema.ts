import { z } from 'zod';

import { projectedObjectWithCountsSchema } from './projected-object.schema';

export const searchObjectResultSchema = z.object({
  object_id: z.string(),
  object_type: z.string(),
  name: z.string().nullable(),
  image_url: z.string().nullable(),
  parent_name: z.string().nullable(),
});

export const searchUserResultSchema = z.object({
  name: z.string(),
  profile_image: z.string().nullable(),
  reputation: z.number(),
  followers_count: z.number().int(),
  is_following: z.boolean(),
});

export const searchResponseSchema = z.object({
  objects: z.array(searchObjectResultSchema),
  users: z.array(searchUserResultSchema),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const searchCountsResponseSchema = z.object({
  type_counts: z.record(z.string(), z.number().int()),
  total_users: z.number().int(),
});

export type SearchCountsResponse = z.infer<typeof searchCountsResponseSchema>;

export const discoverObjectsResponseSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type DiscoverObjectsResponse = z.infer<typeof discoverObjectsResponseSchema>;

export const discoverUsersResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      reputation: z.number().int(),
      followerCount: z.number().int(),
      is_following: z.boolean(),
    }),
  ),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type DiscoverUsersResponse = z.infer<typeof discoverUsersResponseSchema>;

export const userProfileSchema = z.object({
  name: z.string(),
  displayName: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? ''),
  bio: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? ''),
  avatarUrl: z.string().nullable().optional().default(null),
  coverImageUrl: z.string().nullable().optional().default(null),
  followerCount: z.number().nullable().optional().transform((v) => v ?? 0),
  followingCount: z.number().nullable().optional().transform((v) => v ?? 0),
  postingCount: z.number().nullable().optional().transform((v) => v ?? 0),
  reputation: z.number().nullable().optional().transform((v) => v ?? 0),
  is_following: z.boolean().nullable().optional().transform((v) => Boolean(v)),
  viewer_bell: z.boolean().nullable().optional().transform((v) => Boolean(v)),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const resolveObjectBodySchema = z.object({
  object_id: z.string().min(1),
  update_types: z.array(z.string()).optional(),
  include_rejected: z.boolean().optional(),
});

export const resolveObjectResponseSchema = projectedObjectWithCountsSchema;

export const currencyMarketResponseSchema = z.object({
  current: z.record(z.string(), z.unknown()),
  weekly: z.record(z.string(), z.unknown()),
});

export type CurrencyMarketResponse = z.infer<typeof currencyMarketResponseSchema>;

export const waivWalletResponseSchema = z.object({
  account: z.string(),
  balance: z.string(),
  display: z.record(z.string(), z.unknown()).optional(),
});

export type WaivWalletResponse = z.infer<typeof waivWalletResponseSchema>;

export const hiveWalletResponseSchema = z.object({
  account: z.string(),
  balance: z.record(z.string(), z.unknown()).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
});

export type HiveWalletResponse = z.infer<typeof hiveWalletResponseSchema>;

export const postRewardSchema = z
  .object({
    amount: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    phase: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const postAuthorProfileSchema = z
  .object({
    name: z.string(),
    displayName: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
    reputation: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

export const postVotesSummarySchema = z
  .object({
    totalCount: z.number().nullable().optional(),
    previewVoters: z.array(z.string()).nullable().optional(),
    voted: z.boolean().nullable().optional(),
  })
  .nullable()
  .optional();

export const feedPostItemSchema = z.object({
  id: z.string().nullable().optional(),
  author: z.string(),
  permlink: z.string(),
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  feedAt: z.string().nullable().optional(),
  children: z.number().nullable().optional(),
  pendingPayout: z.string().nullable().optional(),
  totalPayout: z.string().nullable().optional(),
  reward: postRewardSchema,
  thumbnailUrl: z.string().nullable().optional(),
  videoThumbnailUrl: z.string().nullable().optional(),
  videoEmbedUrl: z.string().nullable().optional(),
  authorProfile: postAuthorProfileSchema,
  votes: postVotesSummarySchema,
  objects: z.array(projectedObjectWithCountsSchema).nullable().optional(),
});

export type FeedPostItem = z.infer<typeof feedPostItemSchema>;

export const paginatedFeedPostsSchema = z.object({
  items: z.array(feedPostItemSchema),
  cursor: z.string().nullable().optional(),
  hasMore: z.boolean().nullable().optional(),
});

export type PaginatedFeedPosts = z.infer<typeof paginatedFeedPostsSchema>;

export const singlePostSchema = z.object({
  id: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  permlink: z.string(),
  title: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  children: z.number().nullable().optional(),
  reward: postRewardSchema,
  thumbnailUrl: z.string().nullable().optional(),
  videoThumbnailUrl: z.string().nullable().optional(),
  videoEmbedUrl: z.string().nullable().optional(),
  authorProfile: postAuthorProfileSchema,
  votes: postVotesSummarySchema,
  objects: z.array(projectedObjectWithCountsSchema).nullable().optional(),
});

export type SinglePost = z.infer<typeof singlePostSchema>;

export const resolveNestedResponseSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema),
});

export type ResolveNestedResponse = z.infer<typeof resolveNestedResponseSchema>;

export const paginatedUserFollowListSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      displayName: z.string().optional(),
      avatarUrl: z.string().nullable().optional(),
      reputation: z.number().optional(),
      is_following: z.boolean().optional(),
    }),
  ),
  cursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
});

export type PaginatedUserFollowList = z.infer<typeof paginatedUserFollowListSchema>;
