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
  balance: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
  flags: z.record(z.string(), z.unknown()).optional(),
  powerDown: z.record(z.string(), z.unknown()).nullable().optional(),
  rates: z.record(z.string(), z.unknown()).optional(),
});

export type WaivWalletResponse = z.infer<typeof waivWalletResponseSchema>;

export const hiveWalletResponseSchema = z.object({
  account: z.string(),
  balance: z.record(z.string(), z.unknown()).optional(),
  display: z.record(z.string(), z.unknown()).optional(),
  flags: z.record(z.string(), z.unknown()).optional(),
  rc: z.record(z.string(), z.unknown()).optional(),
  powerDown: z.record(z.string(), z.unknown()).nullable().optional(),
  interest: z.record(z.string(), z.unknown()).nullable().optional(),
  pendingSavingsWithdrawals: z.array(z.record(z.string(), z.unknown())).optional(),
  chain: z.record(z.string(), z.unknown()).optional(),
  rates: z.record(z.string(), z.unknown()).optional(),
  pendingRewards: z.record(z.string(), z.unknown()).optional(),
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

export const discussionCommentItemSchema = z.object({
  id: z.string(),
  author: z.string(),
  permlink: z.string(),
  parentAuthor: z.string().optional().default(''),
  parentPermlink: z.string().optional().default(''),
  rootAuthor: z.string().optional().default(''),
  rootPermlink: z.string().optional().default(''),
  depth: z.number().optional().default(1),
  createdAt: z.string().nullable().optional().default(null),
  updatedAt: z.string().nullable().optional().default(null),
  body: z.string().optional().default(''),
  netVotes: z.number().optional().default(0),
  children: z.number().optional().default(0),
  reward: postRewardSchema,
  votes: postVotesSummarySchema,
  authorProfile: postAuthorProfileSchema,
});

export type DiscussionCommentItem = z.infer<typeof discussionCommentItemSchema>;

export const postDiscussionResponseSchema = z.object({
  rootAuthor: z.string().optional().default(''),
  rootPermlink: z.string().optional().default(''),
  rebloggedUsers: z.array(z.string()).optional().default([]),
  rebloggedByViewer: z.boolean().optional().default(false),
  rootCommentIds: z.array(z.string()).optional().default([]),
  childrenById: z.record(z.string(), z.array(z.string())).optional().default({}),
  comments: z.record(z.string(), discussionCommentItemSchema).optional().default({}),
});

export type PostDiscussionResponse = z.infer<typeof postDiscussionResponseSchema>;

export const objectUpdateItemSchema = z.object({
  update_id: z.string(),
  object_id: z.string(),
  update_type: z.string(),
  creator: z.string(),
  locale: z.string().nullable().optional().default(null),
  created_at_unix: z.number().optional().default(0),
  event_seq: z.string().optional().default('0'),
  transaction_id: z.string().optional().default(''),
  value_text: z.string().nullable().optional().default(null),
  value_geo: z.unknown().nullable().optional().default(null),
  value_json: z.unknown().nullable().optional().default(null),
  search_text: z.string().nullable().optional().default(null),
  validity_status: z.string().optional().default('VALID'),
  for_weight: z.number().optional().default(0),
  against_weight: z.number().optional().default(0),
  votes_count: z.number().optional().default(0),
  viewer_vote: z.string().nullable().optional().default(null),
});

export type ObjectUpdateItem = z.infer<typeof objectUpdateItemSchema>;

export const objectUpdatesResponseSchema = z.object({
  items: z.array(objectUpdateItemSchema).optional().default([]),
  cursor: z.string().nullable().optional().default(null),
  hasMore: z.boolean().optional().default(false),
});

export type ObjectUpdatesResponse = z.infer<typeof objectUpdatesResponseSchema>;

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
      wobjectsWeight: z.number().optional().default(0),
      usersFollowingCount: z.number().optional().default(0),
      is_following: z.boolean().optional(),
      isCurrentFollowing: z.boolean().optional().default(false),
    }),
  ),
  total: z.number().optional().default(0),
  cursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional().default(false),
});

export type PaginatedUserFollowList = z.infer<typeof paginatedUserFollowListSchema>;

export const userAccountSidebarSchema = z.object({
  about: z.string().nullable().optional().transform((v) => v ?? ''),
  location: z.string().nullable().optional().default(null),
  website: z.string().nullable().optional().default(null),
  email: z.string().nullable().optional().default(null),
  joinedAt: z.string().nullable().optional().default(null),
  expertiseWeight: z.number().nullable().optional().transform((v) => v ?? 0),
  lastActivityAt: z.string().nullable().optional().default(null),
  totalVoteValueUsd: z.number().nullable().optional().transform((v) => v ?? 0),
  socialLinks: z
    .array(
      z.object({
        type: z.string(),
        value: z.string(),
        href: z.string(),
      }),
    )
    .nullable()
    .optional()
    .transform((v) => v ?? []),
  cryptoWallets: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional().default(''),
        shortName: z.string().optional().default(''),
        abbreviation: z.string().optional().default(''),
        address: z.string().optional().default(''),
        icon: z.string().optional().default(''),
        coingeckoId: z.string().optional().default(''),
      }),
    )
    .nullable()
    .optional()
    .transform((v) => v ?? []),
  waiv: z
    .object({
      upvotingManaPercent: z.number().nullable().optional().transform((v) => v ?? 0),
      downvotingManaPercent: z.number().nullable().optional().transform((v) => v ?? 0),
      voteValueUsd: z.number().nullable().optional().transform((v) => v ?? 0),
    })
    .optional()
    .default({ upvotingManaPercent: 0, downvotingManaPercent: 0, voteValueUsd: 0 }),
  hive: z
    .object({
      reputation: z.number().nullable().optional().transform((v) => v ?? 25),
      upvotingManaPercent: z.number().nullable().optional().transform((v) => v ?? 0),
      downvotingManaPercent: z.number().nullable().optional().transform((v) => v ?? 0),
      resourceCreditsPercent: z.number().nullable().optional().transform((v) => v ?? 0),
      voteValueUsd: z.number().nullable().optional().transform((v) => v ?? 0),
    })
    .optional()
    .default({
      reputation: 25,
      upvotingManaPercent: 0,
      downvotingManaPercent: 0,
      resourceCreditsPercent: 0,
      voteValueUsd: 0,
    }),
});

export type UserAccountSidebar = z.infer<typeof userAccountSidebarSchema>;

export const userBlogObjectFiltersSchema = z.object({
  items: z
    .array(
      z.object({
        object_id: z.string(),
        name: z.string(),
        count: z.number(),
      }),
    )
    .optional()
    .default([]),
});

export type UserBlogObjectFilters = z.infer<typeof userBlogObjectFiltersSchema>;

export const userActivityResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        operationIndex: z.number().optional().default(0),
        trxId: z.string().optional().default(''),
        timestamp: z.string(),
        block: z.number().optional().default(0),
        type: z.string(),
        payload: z.record(z.string(), z.unknown()).optional().default({}),
      }),
    )
    .optional()
    .default([]),
  cursor: z.string().nullable().optional().default(null),
  hasMore: z.boolean().optional().default(false),
  chainContext: z
    .object({
      totalVestingShares: z.string().optional().default('0'),
      totalVestingFundSteem: z.string().optional().default('0'),
    })
    .optional()
    .default({ totalVestingShares: '0', totalVestingFundSteem: '0' }),
});

export type UserActivityResponse = z.infer<typeof userActivityResponseSchema>;

export const userFollowingObjectsResponseSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema).optional().default([]),
  total: z.number().optional().default(0),
  hasMore: z.boolean().optional().default(false),
});

export type UserFollowingObjectsResponse = z.infer<typeof userFollowingObjectsResponseSchema>;

export const userFavoritesTypesResponseSchema = z.object({
  types: z.array(z.string()).optional().default([]),
});

export type UserFavoritesTypesResponse = z.infer<typeof userFavoritesTypesResponseSchema>;

export const userFavoritesListResponseSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema).optional().default([]),
  total: z.number().optional().default(0),
  hasMore: z.boolean().optional().default(false),
});

export type UserFavoritesListResponse = z.infer<typeof userFavoritesListResponseSchema>;

export const userExpertiseCountersResponseSchema = z.object({
  hashtagsCount: z.number().optional().default(0),
  objectsCount: z.number().optional().default(0),
});

export type UserExpertiseCountersResponse = z.infer<typeof userExpertiseCountersResponseSchema>;

export const userExpertiseObjectsResponseSchema = z.object({
  items: z
    .array(
      projectedObjectWithCountsSchema.extend({
        user_weight: z.number().optional().default(0),
      }),
    )
    .optional()
    .default([]),
  total: z.number().optional().default(0),
  hasMore: z.boolean().optional().default(false),
});

export type UserExpertiseObjectsResponse = z.infer<typeof userExpertiseObjectsResponseSchema>;

export const userCategoriesResponseSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string(),
        has_children: z.boolean().optional().default(false),
      }),
    )
    .optional()
    .default([]),
  uncategorized_count: z.number().optional().default(0),
  show_other: z.boolean().optional().default(false),
});

export type UserCategoriesResponse = z.infer<typeof userCategoriesResponseSchema>;

export const userShopFiltersResponseSchema = z.object({
  ratings: z.array(z.number()).optional().default([]),
  categories: z
    .array(
      z.object({
        category: z.string(),
        items: z
          .array(
            z.object({
              value: z.string(),
              count: z.number(),
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
});

export type UserShopFiltersResponse = z.infer<typeof userShopFiltersResponseSchema>;

export const userShopSectionsResponseSchema = z.object({
  sections: z
    .array(
      z.object({
        categoryName: z.string(),
        items: z.array(projectedObjectWithCountsSchema).optional().default([]),
        totalObjects: z.number().optional().default(0),
      }),
    )
    .optional()
    .default([]),
  cursor: z.string().nullable().optional().default(null),
  hasMore: z.boolean().optional().default(false),
});

export type UserShopSectionsResponse = z.infer<typeof userShopSectionsResponseSchema>;

export const userShopObjectsResponseSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema).optional().default([]),
  cursor: z.string().nullable().optional().default(null),
  hasMore: z.boolean().optional().default(false),
});

export type UserShopObjectsResponse = z.infer<typeof userShopObjectsResponseSchema>;

export const engineWalletResponseSchema = z.object({
  account: z.string(),
  pinnedTokens: z
    .array(
      z.object({
        symbol: z.string(),
        name: z.string(),
        iconUrl: z.string().nullable().optional().default(null),
        balance: z.string(),
        stake: z.string(),
        stakingEnabled: z.boolean().optional().default(false),
        precision: z.number().optional().default(3),
        usdEstimate: z.number().optional().default(0),
        isPinned: z.boolean().optional().default(false),
      }),
    )
    .optional()
    .default([]),
  tokens: z
    .array(
      z.object({
        symbol: z.string(),
        name: z.string(),
        iconUrl: z.string().nullable().optional().default(null),
        balance: z.string(),
        stake: z.string(),
        stakingEnabled: z.boolean().optional().default(false),
        precision: z.number().optional().default(3),
        usdEstimate: z.number().optional().default(0),
        isPinned: z.boolean().optional().default(false),
      }),
    )
    .optional()
    .default([]),
  estimatedAccountValueUsd: z.number().optional().default(0),
});

export type EngineWalletResponse = z.infer<typeof engineWalletResponseSchema>;

export const walletHistoryResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        timestamp: z.string(),
        operation: z.string(),
        kind: z.string(),
        source: z.string().optional().default('rpc'),
        payload: z.record(z.string(), z.unknown()).optional().default({}),
      }),
    )
    .optional()
    .default([]),
  cursor: z.string().nullable().optional().default(null),
  hasMore: z.boolean().optional().default(false),
});

export type WalletHistoryResponse = z.infer<typeof walletHistoryResponseSchema>;

export const userAuthorityListResponseSchema = z.object({
  items: z
    .array(
      z.object({
        grantor: z.string().optional(),
        grantee: z.string().optional(),
        accountName: z.string().optional(),
        authorityType: z.enum(['owner', 'active', 'posting']),
        avatarUrl: z.string().nullable().optional().default(null),
        wobjectsWeight: z.number().optional().default(0),
        usersFollowingCount: z.number().optional().default(0),
      }),
    )
    .optional()
    .default([]),
  total: z.number().optional().default(0),
  hasMore: z.boolean().optional().default(false),
});

export type UserAuthorityListResponse = z.infer<typeof userAuthorityListResponseSchema>;

export const hiveHpDelegationsResponseSchema = z.object({
  incoming: z
    .array(
      z.object({
        delegator: z.string(),
        hp: z.string(),
        vestingShares: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  outgoing: z
    .array(
      z.object({
        delegatee: z.string(),
        hp: z.string(),
        vestingShares: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  expirations: z
    .array(
      z.object({
        delegator: z.string().optional().default(''),
        hp: z.string(),
        expiration: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

export type HiveHpDelegationsResponse = z.infer<typeof hiveHpDelegationsResponseSchema>;

export const hiveRcDelegationsResponseSchema = z.object({
  incoming: z
    .array(
      z.object({
        from: z.string(),
        delegatedRc: z.union([z.number(), z.string()]),
      }),
    )
    .optional()
    .default([]),
  outgoing: z
    .array(
      z.object({
        to: z.string(),
        delegatedRc: z.union([z.number(), z.string()]),
      }),
    )
    .optional()
    .default([]),
});

export type HiveRcDelegationsResponse = z.infer<typeof hiveRcDelegationsResponseSchema>;

export const engineTokenDelegationsResponseSchema = z.object({
  incoming: z
    .array(
      z.object({
        from: z.string(),
        to: z.string().optional(),
        symbol: z.string().optional().default('WAIV'),
        quantity: z.string(),
      }),
    )
    .optional()
    .default([]),
  outgoing: z
    .array(
      z.object({
        from: z.string().optional(),
        to: z.string(),
        symbol: z.string().optional().default('WAIV'),
        quantity: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type EngineTokenDelegationsResponse = z.infer<typeof engineTokenDelegationsResponseSchema>;

export const engineSwapListResponseSchema = z.object({
  account: z.string().optional().default(''),
  tokens: z
    .array(
      z.object({
        symbol: z.string(),
        name: z.string().optional().default(''),
        balance: z.string(),
        precision: z.coerce.number().optional().default(3),
        iconUrl: z.string().nullable().optional().default(null),
        pairs: z
          .array(
            z.object({
              symbol: z.string(),
              tokenPair: z.string(),
              precision: z.coerce.number().optional().default(3),
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
});

export type EngineSwapListResponse = z.infer<typeof engineSwapListResponseSchema>;

export const engineSwapQuoteResponseSchema = z.object({
  amountOut: z.string(),
  minAmountOut: z.string().optional().default('0'),
  priceImpact: z.string().optional().default('0'),
  feePercentOptions: z.array(z.number()).optional().default([0.5, 1, 2, 5]),
  customJson: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

export type EngineSwapQuoteResponse = z.infer<typeof engineSwapQuoteResponseSchema>;

export const engineDepositListResponseSchema = z.object({
  account: z.string().optional().default(''),
  tokens: z
    .array(
      z.object({
        symbol: z.string(),
        displayName: z.string().optional().default(''),
        swapSymbol: z.string(),
        pairLabel: z.string().optional().default(''),
      }),
    )
    .optional()
    .default([]),
});

export type EngineDepositListResponse = z.infer<typeof engineDepositListResponseSchema>;

export const engineDepositAddressResponseSchema = z.object({
  symbol: z.string().optional().default('HIVE'),
  account: z.string().nullable().optional().default(null),
  memo: z.string().nullable().optional().default(null),
  address: z.string().nullable().optional().default(null),
  pair: z.string().nullable().optional().default(null),
  exRate: z.number().nullable().optional().default(1),
});

export type EngineDepositAddressResponse = z.infer<typeof engineDepositAddressResponseSchema>;

export const engineWithdrawListResponseSchema = z.object({
  account: z.string().optional().default(''),
  tokens: z
    .array(
      z.object({
        inputSymbol: z.string(),
        outputSymbol: z.string(),
        balanceSymbol: z.string().optional().default(''),
        displayName: z.string().optional().default(''),
        label: z.string().optional().default(''),
        balance: z.string(),
        precision: z.coerce.number().optional().default(3),
        requiresExternalAddress: z.boolean().optional().default(false),
        minimumSwapAmount: z.number().nullable().optional().default(null),
        minimumReceiveAmount: z.number().nullable().optional().default(null),
      }),
    )
    .optional()
    .default([]),
});

export type EngineWithdrawListResponse = z.infer<typeof engineWithdrawListResponseSchema>;

export const engineWithdrawQuoteResponseSchema = z.object({
  predictiveAmount: z.number().nullable().optional().default(null),
  customJsonPayload: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  error: z.string().optional(),
  errorCode: z.string().optional(),
});

export type EngineWithdrawQuoteResponse = z.infer<typeof engineWithdrawQuoteResponseSchema>;
