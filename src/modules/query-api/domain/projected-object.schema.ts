import { z } from 'zod';

export const projectedObjectSchema = z.object({
  object_id: z.string(),
  object_type: z.string(),
  semantic_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  weight: z.number().nullable().optional(),
  fields: z.record(z.string(), z.unknown()),
  hasAdministrativeAuthority: z.boolean().nullable().optional().transform((v) => Boolean(v)),
  hasOwnershipAuthority: z.boolean().nullable().optional().transform((v) => Boolean(v)),
  isFavorited: z.boolean().nullable().optional(),
  listItemsCount: z.number().nullable().optional(),
  previewGallery: z
    .array(
      z.object({
        url: z.string(),
        rankScore: z.number().nullable().optional(),
        isAvatar: z.boolean().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

export type ProjectedObject = z.infer<typeof projectedObjectSchema>;

export const projectedObjectWithCountsSchema = projectedObjectSchema.extend({
  followers_count: z.number().nullable().optional(),
  posts_count: z.number().nullable().optional(),
  updates_count: z.number().nullable().optional(),
  is_following: z.boolean().nullable().optional(),
  viewer_bell: z.boolean().nullable().optional(),
});

export type ProjectedObjectWithCounts = z.infer<typeof projectedObjectWithCountsSchema>;

export const paginatedProjectedObjectsSchema = z.object({
  items: z.array(projectedObjectWithCountsSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PaginatedProjectedObjects = z.infer<typeof paginatedProjectedObjectsSchema>;

export type ResolvedListItem = {
  object_id: string;
  object_type: string;
  fields: Record<string, unknown>;
  weight?: number | null;
  isFavorited?: boolean;
  listItemsCount?: number;
  addedAtUnix?: string;
  update_id?: string;
};

export function getObjectDisplayName(
  obj: { object_id: string; fields?: Record<string, unknown> } | null | undefined,
): string {
  if (!obj) return '';
  const name = obj.fields?.name;
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim();
  }
  return obj.object_id;
}

export function getObjectAvatarUrl(
  obj:
    | {
        fields?: Record<string, unknown>;
        previewGallery?: Array<{ url: string; isAvatar?: boolean | null }> | null;
      }
    | null
    | undefined,
): string | null {
  if (!obj) return null;
  const img = obj.fields?.image ?? obj.fields?.avatar;
  if (typeof img === 'string' && img.trim().length > 0) {
    return img.trim();
  }
  const preview = obj.previewGallery?.[0]?.url;
  if (typeof preview === 'string' && preview.trim().length > 0) {
    return preview.trim();
  }
  return null;
}

export function getObjectDescription(
  obj: { fields?: Record<string, unknown> } | null | undefined,
): string | null {
  if (!obj) return null;
  const desc = obj.fields?.description;
  if (typeof desc === 'string' && desc.trim().length > 0) {
    return desc.trim();
  }
  return null;
}

export function getObjectTitle(
  obj: { fields?: Record<string, unknown> } | null | undefined,
): string | null {
  if (!obj) return null;
  const title = obj.fields?.title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title.trim();
  }
  return null;
}

export function getSortedListItems(obj: ProjectedObject | null | undefined): ResolvedListItem[] {
  if (!obj || !Array.isArray(obj.fields?.listItem)) {
    return [];
  }
  const rawItems = obj.fields.listItem as unknown[];
  const items: ResolvedListItem[] = [];
  for (const raw of rawItems) {
    if (raw && typeof raw === 'object' && 'object_id' in raw) {
      const r = raw as Record<string, unknown>;
      items.push({
        object_id: String(r.object_id),
        object_type: typeof r.object_type === 'string' ? r.object_type : 'object',
        fields:
          r.fields && typeof r.fields === 'object' ? (r.fields as Record<string, unknown>) : {},
        weight: typeof r.weight === 'number' ? r.weight : null,
        isFavorited: Boolean(r.isFavorited),
        listItemsCount: typeof r.listItemsCount === 'number' ? r.listItemsCount : undefined,
        addedAtUnix: typeof r.addedAtUnix === 'string' ? r.addedAtUnix : undefined,
        update_id: typeof r.update_id === 'string' ? r.update_id : undefined,
      });
    }
  }

  const sortCustom = obj.fields?.sortCustom as
    | { include?: unknown[]; exclude?: unknown[] }
    | undefined;
  const excludeSet = new Set(
    Array.isArray(sortCustom?.exclude) ? sortCustom.exclude.map((x) => String(x)) : [],
  );
  const filtered = items.filter((item) => !excludeSet.has(item.object_id));

  if (Array.isArray(sortCustom?.include) && sortCustom.include.length > 0) {
    const orderMap = new Map<string, number>();
    sortCustom.include.forEach((id, idx) => {
      orderMap.set(String(id), idx);
    });
    return [...filtered].sort((a, b) => {
      const ia = orderMap.get(a.object_id);
      const ib = orderMap.get(b.object_id);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return 0;
    });
  }

  return filtered;
}
