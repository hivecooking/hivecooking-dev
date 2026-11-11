'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getGovernanceObjectId, getHiveCustomJsonId } from '@/config/runtime';
import { openLoginModal } from '@/components/post-interactions';
import {
  fetchDiscoverUsers,
  fetchObjectFollowers,
  fetchObjectUpdates,
  fetchSearch,
  getObjectAvatarUrl,
  getObjectDescription,
  getObjectDisplayName,
  getObjectTitle,
  resolveObject,
  type FeedPostItem,
  type ObjectUpdateItem,
  type ProjectedObjectWithCounts,
  type ResolvedListItem,
} from '@/modules/query-api';
import {
  buildOdlGalleryItemWithAlbumEnsureOp,
  buildOdlObjectAuthorityOp,
  buildOdlObjectFollowOp,
  buildOdlUpdateCreateWithLikeOp,
  buildOdlUpdateVoteOp,
  useWallet,
  type OdlUpdateCreateValueKind,
} from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

// ============================================================================
// 1. SITE ADMIN RESOLUTION (`governance-31abe670`)
// ============================================================================

const DEFAULT_SITE_ADMINS = new Set([
  'hivecooking',
  'grampo',
  'liubaru1',
  'dataoperator2',
  'bookguide',
  'nowayjosecuisine',
  'emaninthekitchen',
  'cookinwithgreg',
  'mrsbakerskitchen',
  'kingofreviews',
  'versentry',
  'recipes.curator',
  'recipes.editor',
  'lex.agent',
  'ora.agent',
  'gemma.agent',
]);

let cachedGovernanceAdmins: Set<string> | null = null;
let governanceFetchPromise: Promise<Set<string>> | null = null;

function extractAccountNamesFromField(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim().toLowerCase());
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const val = rec.value ?? rec.account ?? rec.name;
      if (typeof val === 'string' && val.trim()) {
        out.push(val.trim().toLowerCase());
      }
    }
  }
  return out;
}

async function loadGovernanceAdmins(): Promise<Set<string>> {
  if (cachedGovernanceAdmins) return cachedGovernanceAdmins;
  if (governanceFetchPromise) return governanceFetchPromise;

  governanceFetchPromise = (async () => {
    const merged = new Set(DEFAULT_SITE_ADMINS);
    try {
      const res = await resolveObject({ object_id: getGovernanceObjectId() });
      if (isOk(res)) {
        const fields = res.value.fields ?? {};
        for (const acc of extractAccountNamesFromField(fields.admins)) merged.add(acc);
        for (const acc of extractAccountNamesFromField(fields.moderators)) merged.add(acc);
        for (const acc of extractAccountNamesFromField(fields.trusted)) merged.add(acc);
        for (const acc of extractAccountNamesFromField(fields.authorities)) merged.add(acc);
      }
    } catch {
      // Keep default fallback set on network failure
    }
    cachedGovernanceAdmins = merged;
    return merged;
  })();

  return governanceFetchPromise;
}

export function useIsSiteAdmin(usernameInput?: string | null): boolean {
  const { username: walletUsername } = useWallet();
  const effectiveUser = (usernameInput ?? walletUsername)?.trim().toLowerCase() ?? '';
  const [adminSet, setAdminSet] = useState<Set<string>>(
    () => cachedGovernanceAdmins ?? DEFAULT_SITE_ADMINS,
  );

  useEffect(() => {
    if (!effectiveUser) return;
    let active = true;
    void loadGovernanceAdmins().then((loaded) => {
      if (active) setAdminSet(new Set(loaded));
    });
    return () => {
      active = false;
    };
  }, [effectiveUser]);

  if (!effectiveUser) return false;
  return adminSet.has(effectiveUser);
}

// ============================================================================
// 2. ODL UPDATE REGISTRY & OBJECT TYPE CATALOG (Matches open-infrastructure)
// ============================================================================

export type UpdateFieldMeta = {
  update_type: string;
  label: string;
  value_kind: OdlUpdateCreateValueKind;
  localizable: boolean;
  group:
    | 'header'
    | 'publication'
    | 'details'
    | 'community'
    | 'gallery'
    | 'visit'
    | 'commerce'
    | 'recipe'
    | 'contact'
    | 'payments'
    | 'content'
    | 'catalog'
    | 'governance'
    | 'object';
  description?: string;
  applies_to?: readonly string[];
};

export const EDIT_GROUP_LABELS: Record<UpdateFieldMeta['group'], string> = {
  header: 'Header',
  publication: 'Publication',
  details: 'Details',
  community: 'Community',
  gallery: 'Gallery',
  visit: 'Visit',
  commerce: 'Commerce',
  recipe: 'Recipe',
  contact: 'Contact',
  payments: 'Payments',
  content: 'Content',
  catalog: 'Catalog',
  governance: 'Governance',
  object: 'Object',
};

export const EDIT_GROUP_ORDER: ReadonlyArray<UpdateFieldMeta['group']> = [
  'header',
  'publication',
  'details',
  'community',
  'gallery',
  'visit',
  'commerce',
  'recipe',
  'contact',
  'payments',
  'content',
  'catalog',
  'governance',
  'object',
];

export const UPDATE_FIELD_REGISTRY: Record<string, UpdateFieldMeta> = {
  // Header
  name: { update_type: 'name', label: 'Name', value_kind: 'text', localizable: true, group: 'header' },
  title: { update_type: 'title', label: 'Title', value_kind: 'text', localizable: true, group: 'header' },
  image: { update_type: 'image', label: 'Avatar', value_kind: 'json', localizable: true, group: 'header' },
  imageBackground: { update_type: 'imageBackground', label: 'Background', value_kind: 'json', localizable: true, group: 'header' },

  // Publication
  author: { update_type: 'author', label: 'Author', value_kind: 'object_ref', localizable: false, group: 'publication', applies_to: ['person'] },
  publisher: { update_type: 'publisher', label: 'Publisher', value_kind: 'object_ref', localizable: false, group: 'publication', applies_to: ['business'] },
  datePublished: { update_type: 'datePublished', label: 'Published', value_kind: 'text', localizable: false, group: 'publication' },
  inLanguage: { update_type: 'inLanguage', label: 'Language', value_kind: 'text', localizable: false, group: 'publication' },
  printLength: { update_type: 'printLength', label: 'Print length', value_kind: 'text', localizable: false, group: 'publication' },
  typicalAgeRange: { update_type: 'typicalAgeRange', label: 'Age Range', value_kind: 'text', localizable: true, group: 'publication' },

  // Details
  parent: { update_type: 'parent', label: 'Parent', value_kind: 'object_ref', localizable: false, group: 'details' },
  menuItem: { update_type: 'menuItem', label: 'Menu', value_kind: 'json', localizable: true, group: 'details' },
  button: { update_type: 'button', label: 'Buttons', value_kind: 'json', localizable: true, group: 'details' },
  description: { update_type: 'description', label: 'Description', value_kind: 'text', localizable: true, group: 'details' },

  // Community
  aggregateRating: { update_type: 'aggregateRating', label: 'Ratings', value_kind: 'text', localizable: true, group: 'community' },
  tagCategory: { update_type: 'tagCategory', label: 'Tag Category', value_kind: 'text', localizable: true, group: 'community' },
  tagCategoryItem: { update_type: 'tagCategoryItem', label: 'Tag', value_kind: 'json', localizable: true, group: 'community' },
  category: { update_type: 'category', label: 'Categories', value_kind: 'text', localizable: false, group: 'community' },

  // Gallery
  imageGallery: { update_type: 'imageGallery', label: 'Gallery', value_kind: 'text', localizable: false, group: 'gallery' },
  imageGalleryItem: { update_type: 'imageGalleryItem', label: 'Gallery item', value_kind: 'json', localizable: false, group: 'gallery' },

  // Visit
  workHours: { update_type: 'workHours', label: 'Hours', value_kind: 'text', localizable: true, group: 'visit' },
  address: { update_type: 'address', label: 'Address', value_kind: 'json', localizable: true, group: 'visit' },
  geo: { update_type: 'geo', label: 'Map', value_kind: 'geo', localizable: false, group: 'visit' },

  // Commerce
  compareAtPrice: { update_type: 'compareAtPrice', label: 'Compare-at Price', value_kind: 'text', localizable: true, group: 'commerce' },
  price: { update_type: 'price', label: 'Price', value_kind: 'text', localizable: true, group: 'commerce' },
  saleEvent: { update_type: 'saleEvent', label: 'Sale', value_kind: 'json', localizable: false, group: 'commerce' },
  option: { update_type: 'option', label: 'Options', value_kind: 'json', localizable: true, group: 'commerce' },
  budget: { update_type: 'budget', label: 'Budget', value_kind: 'text', localizable: true, group: 'commerce' },
  productWeight: { update_type: 'productWeight', label: 'Weight', value_kind: 'json', localizable: true, group: 'commerce' },
  size: { update_type: 'size', label: 'Size', value_kind: 'json', localizable: true, group: 'commerce' },
  merchant: { update_type: 'merchant', label: 'Merchant', value_kind: 'object_ref', localizable: false, group: 'commerce', applies_to: ['business'] },
  brand: { update_type: 'brand', label: 'Brand', value_kind: 'object_ref', localizable: false, group: 'commerce', applies_to: ['business'] },
  manufacturer: { update_type: 'manufacturer', label: 'Manufacturer', value_kind: 'object_ref', localizable: false, group: 'commerce', applies_to: ['business'] },
  featureList: { update_type: 'featureList', label: 'Features', value_kind: 'json', localizable: true, group: 'commerce' },
  addOn: { update_type: 'addOn', label: 'Add-on', value_kind: 'object_ref', localizable: false, group: 'commerce' },
  isRelatedTo: { update_type: 'isRelatedTo', label: 'Related items', value_kind: 'object_ref', localizable: false, group: 'commerce' },
  isSimilarTo: { update_type: 'isSimilarTo', label: 'Similar', value_kind: 'object_ref', localizable: false, group: 'commerce' },

  // Recipe
  cookTime: { update_type: 'cookTime', label: 'Cooking time', value_kind: 'text', localizable: true, group: 'recipe' },
  calories: { update_type: 'calories', label: 'Calories', value_kind: 'text', localizable: true, group: 'recipe' },
  nutrition: { update_type: 'nutrition', label: 'Macros', value_kind: 'text', localizable: true, group: 'recipe' },
  ingredients: { update_type: 'ingredients', label: 'Ingredients', value_kind: 'json', localizable: true, group: 'recipe' },
  servings: { update_type: 'servings', label: 'Servings', value_kind: 'text', localizable: true, group: 'recipe' },

  // Contact
  website: { update_type: 'website', label: 'Website', value_kind: 'json', localizable: true, group: 'contact' },
  link: { update_type: 'link', label: 'Social Links', value_kind: 'json', localizable: false, group: 'contact' },
  telephone: { update_type: 'telephone', label: 'Phone', value_kind: 'json', localizable: true, group: 'contact' },
  email: { update_type: 'email', label: 'Email', value_kind: 'text', localizable: false, group: 'contact' },

  // Payments
  walletAddress: { update_type: 'walletAddress', label: 'Wallet', value_kind: 'json', localizable: false, group: 'payments' },

  // Content
  url: { update_type: 'url', label: 'Url', value_kind: 'text', localizable: false, group: 'content' },
  pageContent: { update_type: 'pageContent', label: 'Page content', value_kind: 'text', localizable: true, group: 'content' },
  htmlContent: { update_type: 'htmlContent', label: 'HTML content', value_kind: 'text', localizable: true, group: 'content' },
  contentView: { update_type: 'contentView', label: 'Content view', value_kind: 'text', localizable: false, group: 'content' },

  // Catalog
  sortCustom: { update_type: 'sortCustom', label: 'List sorting', value_kind: 'json', localizable: true, group: 'catalog' },
  listItem: { update_type: 'listItem', label: 'List item', value_kind: 'object_ref', localizable: false, group: 'catalog' },
  featured: { update_type: 'featured', label: 'Featured', value_kind: 'object_ref', localizable: false, group: 'catalog' },
  promotion: { update_type: 'promotion', label: 'Promotion', value_kind: 'json', localizable: false, group: 'catalog' },
  pin: { update_type: 'pin', label: 'Pin post', value_kind: 'text', localizable: true, group: 'catalog' },
  remove: { update_type: 'remove', label: 'Remove post', value_kind: 'text', localizable: false, group: 'catalog' },

  // Governance
  admins: { update_type: 'admins', label: 'Administrators', value_kind: 'user_ref', localizable: false, group: 'governance' },
  moderators: { update_type: 'moderators', label: 'Moderators', value_kind: 'user_ref', localizable: false, group: 'governance' },
  trusted: { update_type: 'trusted', label: 'Trusted accounts', value_kind: 'user_ref', localizable: false, group: 'governance' },
  authorities: { update_type: 'authorities', label: 'Authorities', value_kind: 'user_ref', localizable: false, group: 'governance' },
  authors: { update_type: 'authors', label: 'Authors', value_kind: 'user_ref', localizable: false, group: 'governance' },
  whitelist: { update_type: 'whitelist', label: 'Whitelist', value_kind: 'user_ref', localizable: false, group: 'governance' },
  restricted: { update_type: 'restricted', label: 'Restricted', value_kind: 'user_ref', localizable: false, group: 'governance' },
  banned: { update_type: 'banned', label: 'Banned', value_kind: 'user_ref', localizable: false, group: 'governance' },

  // Object
  identifier: { update_type: 'identifier', label: 'Identifier', value_kind: 'json', localizable: false, group: 'object' },
  productGroupId: { update_type: 'productGroupId', label: 'Product Group ID', value_kind: 'text', localizable: false, group: 'object' },
  status: { update_type: 'status', label: 'Status', value_kind: 'json', localizable: false, group: 'object' },
  delegation: { update_type: 'delegation', label: 'Delegation', value_kind: 'user_ref', localizable: false, group: 'object' },
};

export const OBJECT_TYPE_SUPPORTED_UPDATES: Record<string, readonly string[]> = {
  list: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'description',
    'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'website', 'contentView',
    'sortCustom', 'listItem', 'promotion', 'pin', 'remove',
    'status', 'delegation',
  ],
  recipe: [
    'name', 'title', 'image', 'imageBackground',
    'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem', 'category',
    'imageGallery', 'imageGalleryItem',
    'budget', 'featureList', 'addOn', 'isSimilarTo',
    'cookTime', 'calories', 'nutrition', 'ingredients', 'servings',
    'promotion', 'pin', 'remove',
    'identifier', 'status', 'delegation',
  ],
  product: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'menuItem', 'button', 'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem', 'category',
    'imageGallery', 'imageGalleryItem',
    'compareAtPrice', 'price', 'saleEvent', 'option', 'productWeight', 'size',
    'merchant', 'brand', 'manufacturer', 'featureList', 'addOn', 'isRelatedTo', 'isSimilarTo',
    'website',
    'sortCustom', 'listItem', 'promotion', 'pin', 'remove',
    'identifier', 'productGroupId', 'status', 'delegation',
  ],
  book: [
    'name', 'title', 'image', 'imageBackground',
    'author', 'publisher', 'datePublished', 'inLanguage', 'printLength', 'typicalAgeRange',
    'parent', 'menuItem', 'button', 'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem', 'category',
    'imageGallery', 'imageGalleryItem',
    'compareAtPrice', 'price', 'saleEvent', 'option', 'productWeight', 'size',
    'addOn', 'isRelatedTo', 'isSimilarTo',
    'website',
    'sortCustom', 'listItem', 'promotion', 'pin', 'remove',
    'identifier', 'productGroupId', 'status', 'delegation',
  ],
  business: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'menuItem', 'button', 'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'price', 'workHours', 'address', 'geo',
    'website', 'link', 'telephone', 'email',
    'walletAddress',
    'sortCustom', 'listItem', 'featured', 'promotion', 'pin', 'remove',
    'identifier', 'status', 'delegation',
  ],
  restaurant: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'menuItem', 'button', 'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'price', 'workHours', 'address', 'geo',
    'website', 'link', 'telephone', 'email',
    'walletAddress',
    'sortCustom', 'listItem', 'promotion', 'pin', 'remove',
    'identifier', 'status', 'delegation',
  ],
  person: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'menuItem', 'button', 'description',
    'aggregateRating', 'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'price', 'workHours', 'address', 'geo',
    'website', 'link', 'telephone', 'email',
    'walletAddress',
    'sortCustom', 'listItem', 'featured', 'promotion', 'pin', 'remove',
    'identifier', 'status', 'delegation',
  ],
  page: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'description',
    'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'website', 'pageContent',
    'promotion', 'pin', 'remove',
    'status', 'delegation',
  ],
  html: [
    'name', 'title', 'image', 'imageBackground',
    'parent', 'description',
    'tagCategory', 'tagCategoryItem',
    'imageGallery', 'imageGalleryItem',
    'website', 'htmlContent', 'contentView',
    'promotion', 'pin', 'remove',
    'status', 'delegation',
  ],
  governance: [
    'name', 'title', 'image', 'imageBackground', 'description',
    'admins', 'moderators', 'trusted', 'authorities', 'authors', 'whitelist', 'restricted', 'banned',
    'status',
  ],
};

export function getSupportedUpdatesForType(objectType: string): readonly string[] {
  const key = objectType.trim().toLowerCase();
  return (
    OBJECT_TYPE_SUPPORTED_UPDATES[key] ??
    OBJECT_TYPE_SUPPORTED_UPDATES.product ??
    Object.keys(UPDATE_FIELD_REGISTRY)
  );
}

export function labelForUpdateType(updateType: string): string {
  return UPDATE_FIELD_REGISTRY[updateType]?.label ?? updateType;
}

const SUPPORTED_LOCALES = [
  { id: 'en-US', label: 'English (en-US)' },
  { id: 'es-ES', label: 'Español (es-ES)' },
  { id: 'fr-FR', label: 'Français (fr-FR)' },
  { id: 'de-DE', label: 'Deutsch (de-DE)' },
  { id: 'it-IT', label: 'Italiano (it-IT)' },
  { id: 'pt-BR', label: 'Português (pt-BR)' },
  { id: 'ru-RU', label: 'Русский (ru-RU)' },
  { id: 'uk-UA', label: 'Українська (uk-UA)' },
  { id: 'zh-CN', label: '中文 (zh-CN)' },
  { id: 'ja-JP', label: '日本語 (ja-JP)' },
];

function extractTagCategoryNames(fields: Record<string, unknown> | undefined): string[] {
  const names: string[] = [];
  if (Array.isArray(fields?.tagCategory)) {
    for (const raw of fields.tagCategory as unknown[]) {
      const val =
        typeof raw === 'string'
          ? raw.trim()
          : raw && typeof raw === 'object' && 'value' in raw
            ? String((raw as Record<string, unknown>).value).trim()
            : raw && typeof raw === 'object' && 'body' in raw
              ? String((raw as Record<string, unknown>).body).trim()
              : '';
      if (val && !names.includes(val)) names.push(val);
    }
  }
  if (Array.isArray(fields?.tagCategoryItem)) {
    for (const raw of fields.tagCategoryItem as unknown[]) {
      if (raw && typeof raw === 'object' && 'category' in raw) {
        const cat = String((raw as Record<string, unknown>).category).trim();
        if (cat && !names.includes(cat)) names.push(cat);
      }
    }
  }
  return names;
}

function extractGalleryAlbumNames(fields: Record<string, unknown> | undefined): string[] {
  const names: string[] = ['Photos'];
  if (Array.isArray(fields?.imageGallery)) {
    for (const raw of fields.imageGallery as unknown[]) {
      const val =
        typeof raw === 'string'
          ? raw.trim()
          : raw && typeof raw === 'object' && 'album' in raw
            ? String((raw as Record<string, unknown>).album).trim()
            : '';
      if (val && !names.includes(val)) names.push(val);
    }
  }
  if (Array.isArray(fields?.imageGalleryItem)) {
    for (const raw of fields.imageGalleryItem as unknown[]) {
      if (raw && typeof raw === 'object' && 'album' in raw) {
        const val = String((raw as Record<string, unknown>).album).trim();
        if (val && !names.includes(val)) names.push(val);
      }
    }
  }
  return names;
}

function formatUnixRelativeTime(sec: number): string {
  if (!sec || sec <= 0) return 'recently';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - sec));
  const days = diffSec / 86400;
  if (days >= 548) return `${Math.round(days / 365)} years ago`;
  if (days >= 320) return 'a year ago';
  if (days >= 45) return `${Math.round(days / 30)} months ago`;
  if (days >= 26) return 'a month ago';
  if (days >= 1.5) return `${Math.round(days)} days ago`;
  if (days >= 0.9) return 'a day ago';
  const hours = Math.round(diffSec / 3600);
  if (hours >= 2) return `${hours} hours ago`;
  if (hours >= 1) return 'an hour ago';
  const mins = Math.round(diffSec / 60);
  if (mins >= 2) return `${mins} mins ago`;
  return 'just now';
}

// ============================================================================
// 3. OBJECT / USER REFERENCE AUTOCOMPLETE PICKERS
// ============================================================================

function ObjectRefPicker({
  value,
  onChange,
  appliesTo,
  placeholder = 'Search object by name or #object_id...',
}: {
  value: string;
  onChange: (objectId: string) => void;
  appliesTo?: readonly string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ object_id: string; object_type: string; name: string | null; image_url: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<{
    object_id: string;
    name: string;
    object_type: string;
    image_url: string | null;
  } | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const res = await fetchSearch({ q, type: 'objects', limit: 12, signal: ctrl.signal });
      if (!ctrl.signal.aborted) {
        setSearching(false);
        if (isOk(res)) {
          const filtered =
            appliesTo && appliesTo.length > 0
              ? res.value.objects.filter((o) => appliesTo.includes(o.object_type))
              : res.value.objects;
          setResults(filtered);
        }
      }
    }, 260);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query, appliesTo]);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-[4px] border border-[#d9d9d9] bg-[#fafafa] p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {selectedMeta?.image_url ? (
              <img
                src={selectedMeta.image_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-[4px] border border-[#e9e7e7] object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#ececec] text-xs font-bold text-[#8c8c8c]">
                #
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#303540]">
                {selectedMeta?.name || value}
              </p>
              <p className="truncate font-mono text-[11px] text-[#8c8c8c]">
                #{value} {selectedMeta?.object_type ? `· ${selectedMeta.object_type}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedMeta(null);
              onChange('');
            }}
            className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-2.5 py-1 text-[11px] font-medium text-[#595959] hover:border-[#af3d36] hover:text-[#af3d36]"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
          />
          {searching ? (
            <p className="mt-1 text-[11px] text-[#8c8c8c]">Searching objects...</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="mt-1 max-h-52 overflow-y-auto rounded-[4px] border border-[#d9d9d9] bg-white shadow-lg">
              {results.map((r) => (
                <li key={r.object_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMeta({
                        object_id: r.object_id,
                        name: r.name || r.object_id,
                        object_type: r.object_type,
                        image_url: r.image_url,
                      });
                      setQuery('');
                      setResults([]);
                      onChange(r.object_id);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#fafafa]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-[4px] object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[#f0f0f0] text-xs text-[#8c8c8c]">
                          —
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#303540]">
                          {r.name || r.object_id}
                        </p>
                        <p className="truncate font-mono text-[11px] text-[#8c8c8c]">
                          #{r.object_id}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded bg-[#f0f0f0] px-2 py-0.5 text-[11px] font-medium text-[#595959]">
                      {r.object_type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2">
            <label className="block text-[11px] text-[#8c8c8c]">
              Or enter exact Object ID directly:
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value.trim())}
              placeholder="e.g. yrc-spaghetti-carbonara"
              className="mt-1 w-full rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] px-2.5 py-1.5 font-mono text-[12px] text-[#303540] outline-none focus:border-[#af3d36]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function UserRefPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (username: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<
    Array<{ name: string; displayName: string; avatarUrl: string | null }>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const res = await fetchDiscoverUsers({ q, limit: 8, signal: ctrl.signal });
      if (!ctrl.signal.aborted) {
        setSearching(false);
        if (isOk(res)) {
          setResults(res.value.items);
        }
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const clean = e.target.value.trim().replace(/^@/, '').toLowerCase();
          setQuery(clean);
          onChange(clean);
        }}
        placeholder="Hive username (e.g. hivecooking)"
        className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
      />
      {searching ? <p className="text-[11px] text-[#8c8c8c]">Searching users...</p> : null}
      {results.length > 0 ? (
        <ul className="max-h-44 overflow-y-auto rounded-[4px] border border-[#d9d9d9] bg-white shadow-sm">
          {results.map((u) => (
            <li key={u.name}>
              <button
                type="button"
                onClick={() => {
                  onChange(u.name);
                  setResults([]);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#fafafa]"
              >
                <img
                  src={u.avatarUrl || `https://images.hive.blog/u/${u.name}/avatar/small`}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="text-[13px] font-medium text-[#303540]">@{u.name}</span>
                {u.displayName ? (
                  <span className="truncate text-[12px] text-[#8c8c8c]">{u.displayName}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ============================================================================
// 4. ADD UPDATE MODAL (Rich Structured Form matching open-infrastructure)
// ============================================================================

export function ObjectEditModal({
  objectId,
  objectName,
  objectType = 'product',
  open,
  onClose,
  onUpdated,
  initialUpdateType,
  initialCategory,
  candidateUpdateTypes,
  tagCategoryNames = [],
  galleryAlbumNames = ['Photos'],
  listCatalogItems = [],
  listSortCustom = null,
}: {
  objectId: string;
  objectName: string;
  objectType?: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  initialUpdateType?: string;
  initialCategory?: string;
  candidateUpdateTypes?: readonly string[];
  tagCategoryNames?: readonly string[];
  galleryAlbumNames?: readonly string[];
  listCatalogItems?: readonly ResolvedListItem[];
  listSortCustom?: { include?: string[]; exclude?: string[]; sortType?: string } | null;
}) {
  const { username, broadcast } = useWallet();
  const supported = useMemo(
    () =>
      candidateUpdateTypes && candidateUpdateTypes.length > 0
        ? candidateUpdateTypes
        : getSupportedUpdatesForType(objectType),
    [candidateUpdateTypes, objectType],
  );

  const [selectedType, setSelectedType] = useState<string>(
    initialUpdateType && UPDATE_FIELD_REGISTRY[initialUpdateType]
      ? initialUpdateType
      : supported[0] ?? 'description',
  );
  const [localeInput, setLocaleInput] = useState('en-US');

  // Form states per field kind
  const [textValue, setTextValue] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [galleryAlbum, setGalleryAlbum] = useState(galleryAlbumNames[0] || 'Photos');
  const [buttonTitle, setButtonTitle] = useState('');
  const [buttonLink, setButtonLink] = useState('');
  const [tagCategory, setTagCategory] = useState(initialCategory || tagCategoryNames[0] || '');
  const [tagValue, setTagValue] = useState('');
  const [featureKey, setFeatureKey] = useState('');
  const [featureVal, setFeatureVal] = useState('');
  const [optionCategory, setOptionCategory] = useState('');
  const [optionValue, setOptionValue] = useState('');
  const [optionPosition, setOptionPosition] = useState('1');
  const [optionImage, setOptionImage] = useState('');
  const [identifierType, setIdentifierType] = useState('ASIN');
  const [identifierVal, setIdentifierVal] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [sizeLength, setSizeLength] = useState('');
  const [sizeWidth, setSizeWidth] = useState('');
  const [sizeDepth, setSizeDepth] = useState('');
  const [sizeUnit, setSizeUnit] = useState('in');
  const [statusTitle, setStatusTitle] = useState('unavailable');
  const [statusLink, setStatusLink] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [geoLat, setGeoLat] = useState('');
  const [geoLon, setGeoLon] = useState('');
  const [rawJsonText, setRawJsonText] = useState('{}');

  // SortCustom state
  const [sortMode, setSortMode] = useState<'custom' | 'recency' | 'reverse_recency' | 'by-name-asc' | 'by-name-desc'>('custom');
  const [sortIncludeIds, setSortIncludeIds] = useState<string[]>([]);
  const [sortExcludeIds, setSortExcludeIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextType =
      initialUpdateType && UPDATE_FIELD_REGISTRY[initialUpdateType]
        ? initialUpdateType
        : supported[0] ?? 'description';
    setSelectedType(nextType);
    setError(null);
    setTxId(null);
    if (initialCategory) {
      setTagCategory(initialCategory);
    } else if (tagCategoryNames.length > 0 && !tagCategory) {
      setTagCategory(tagCategoryNames[0]!);
    }
    if (listCatalogItems.length > 0) {
      const existingInclude = Array.isArray(listSortCustom?.include)
        ? listSortCustom!.include.map(String)
        : [];
      const existingExclude = Array.isArray(listSortCustom?.exclude)
        ? listSortCustom!.exclude.map(String)
        : [];
      const allIds = listCatalogItems.map((i) => i.object_id);
      const ordered = [
        ...existingInclude.filter((id) => allIds.includes(id)),
        ...allIds.filter((id) => !existingInclude.includes(id)),
      ];
      setSortIncludeIds(ordered);
      setSortExcludeIds(existingExclude);
    }
  }, [open, initialUpdateType, initialCategory, supported, tagCategoryNames, listCatalogItems, listSortCustom]);

  if (!open) return null;

  const meta = UPDATE_FIELD_REGISTRY[selectedType] ?? {
    update_type: selectedType,
    label: labelForUpdateType(selectedType),
    value_kind: 'text' as const,
    localizable: true,
    group: 'details' as const,
  };

  const buildPayloadValue = (): unknown => {
    switch (selectedType) {
      case 'image':
      case 'imageBackground': {
        const trimmed = imageUrl.trim();
        if (!trimmed) throw new Error('Please enter an image URL or IPFS CID.');
        if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };
        return { cid: trimmed };
      }
      case 'imageGalleryItem': {
        const trimmed = imageUrl.trim();
        const album = galleryAlbum.trim() || 'Photos';
        if (!trimmed) throw new Error('Please enter an image URL or IPFS CID.');
        if (/^https?:\/\//i.test(trimmed)) return { album, url: trimmed };
        return { album, cid: trimmed };
      }
      case 'button':
      case 'website': {
        if (!buttonTitle.trim() || !buttonLink.trim()) {
          throw new Error('Both Title and Link URL are required.');
        }
        return { title: buttonTitle.trim(), link: buttonLink.trim() };
      }
      case 'tagCategoryItem': {
        const cat = tagCategory.trim() || tagCategoryNames[0] || 'Category';
        if (!tagValue.trim()) throw new Error('Please enter a tag value.');
        return { category: cat, value: tagValue.trim() };
      }
      case 'featureList': {
        if (!featureKey.trim() || !featureVal.trim()) {
          throw new Error('Both Feature name and value are required.');
        }
        return { key: featureKey.trim(), value: featureVal.trim() };
      }
      case 'option': {
        if (!optionCategory.trim() || !optionValue.trim()) {
          throw new Error('Option category and value are required.');
        }
        const payload: Record<string, unknown> = {
          category: optionCategory.trim(),
          value: optionValue.trim(),
          position: Number(optionPosition) || 1,
        };
        if (optionImage.trim()) payload.image = optionImage.trim();
        return payload;
      }
      case 'identifier': {
        if (!identifierType.trim() || !identifierVal.trim()) {
          throw new Error('Identifier type and value are required.');
        }
        return { type: identifierType.trim(), value: identifierVal.trim() };
      }
      case 'productWeight': {
        const num = Number(weightValue);
        if (!Number.isFinite(num) || num <= 0) throw new Error('Enter a valid positive weight.');
        return { value: num, unit: weightUnit };
      }
      case 'size': {
        const l = Number(sizeLength);
        const w = Number(sizeWidth);
        const d = Number(sizeDepth);
        if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(d)) {
          throw new Error('Enter valid numeric length, width, and depth.');
        }
        return { length: l, width: w, depth: d, unit: sizeUnit };
      }
      case 'status': {
        const payload: Record<string, unknown> = { title: statusTitle };
        if (statusLink.trim()) payload.link = statusLink.trim();
        return payload;
      }
      case 'ingredients': {
        const lines = ingredientsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (lines.length === 0) throw new Error('Add at least one ingredient (one per line).');
        return lines;
      }
      case 'sortCustom': {
        return {
          include: sortMode === 'custom' ? sortIncludeIds.filter((id) => !sortExcludeIds.includes(id)) : [],
          exclude: sortExcludeIds,
          sortType: sortMode,
        };
      }
      case 'geo': {
        const lat = Number(geoLat);
        const lon = Number(geoLon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error('Enter valid latitude and longitude coordinates.');
        }
        return { type: 'Point', coordinates: [lon, lat] };
      }
      default: {
        if (meta.value_kind === 'json') {
          try {
            return JSON.parse(rawJsonText);
          } catch {
            throw new Error('Invalid JSON payload.');
          }
        }
        const trimmed = textValue.trim();
        if (!trimmed) throw new Error(`Please enter a value for ${meta.label}.`);
        return trimmed;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      openLoginModal();
      return;
    }

    setSubmitting(true);
    setError(null);
    setTxId(null);

    try {
      const payloadValue = buildPayloadValue();
      const customJsonId = getHiveCustomJsonId();

      const op =
        selectedType === 'imageGalleryItem' &&
        !galleryAlbumNames.includes(galleryAlbum.trim() || 'Photos')
          ? buildOdlGalleryItemWithAlbumEnsureOp({
              id: customJsonId,
              objectId,
              creator: username,
              albumName: galleryAlbum.trim() || 'Photos',
              itemValue: payloadValue,
              withLike: true,
              required_posting_auths: [username],
            })
          : buildOdlUpdateCreateWithLikeOp({
              id: customJsonId,
              objectId,
              updateType: selectedType,
              creator: username,
              valueKind: meta.value_kind,
              value: payloadValue,
              locale: meta.localizable ? localeInput || 'en-US' : undefined,
              required_posting_auths: [username],
            });

      const res = await broadcast([op]);
      setTxId(res.transactionId);
      onUpdated?.();
      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast object update');
    } finally {
      setSubmitting(false);
    }
  };

  const moveSortItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sortIncludeIds.length) return;
    const copy = [...sortIncludeIds];
    const [removed] = copy.splice(idx, 1);
    if (removed) {
      copy.splice(target, 0, removed);
      setSortIncludeIds(copy);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[600px] flex-col rounded-[8px] border border-[#e0e0e0] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-bold text-[#303540]">
              Add Update — {objectName}
            </h2>
            <p className="truncate font-mono text-[11px] text-[#8c8c8c]">#{objectId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded p-1 text-[18px] leading-none text-[#8c8c8c] hover:bg-[#f5f5f5] hover:text-[#303540]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Field Selector */}
          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-[#303540]">
              Suggest field
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setError(null);
                setTxId(null);
              }}
              disabled={Boolean(initialUpdateType && candidateUpdateTypes?.length === 1) || submitting}
              className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36] disabled:bg-[#f5f5f5]"
            >
              {supported.map((ut) => (
                <option key={ut} value={ut}>
                  {labelForUpdateType(ut)} ({ut})
                </option>
              ))}
            </select>
          </div>

          {/* Value Input by Update Type */}
          {selectedType === 'image' || selectedType === 'imageBackground' ? (
            <div className="space-y-3">
              <label className="block text-[12px] font-bold text-[#303540]">
                {meta.label} Image URL or IPFS CID
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.hive.blog/... or Qm..."
                className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
              />
              {imageUrl.trim() && /^https?:\/\//i.test(imageUrl.trim()) ? (
                <div className="overflow-hidden rounded-[4px] border border-[#e9e7e7] bg-[#fafafa] p-2">
                  <img
                    src={imageUrl.trim()}
                    alt="Preview"
                    className="mx-auto max-h-48 object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : selectedType === 'imageGalleryItem' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Gallery Album
                </label>
                <input
                  type="text"
                  list="gallery-albums-list"
                  value={galleryAlbum}
                  onChange={(e) => setGalleryAlbum(e.target.value)}
                  placeholder="Photos"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
                <datalist id="gallery-albums-list">
                  {galleryAlbumNames.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Photo / Video URL or IPFS CID
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              {imageUrl.trim() && /^https?:\/\//i.test(imageUrl.trim()) ? (
                <div className="overflow-hidden rounded-[4px] border border-[#e9e7e7] bg-[#fafafa] p-2">
                  <img
                    src={imageUrl.trim()}
                    alt="Preview"
                    className="mx-auto max-h-48 object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : selectedType === 'button' || selectedType === 'website' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Title *
                </label>
                <input
                  type="text"
                  value={buttonTitle}
                  onChange={(e) => setButtonTitle(e.target.value)}
                  placeholder={selectedType === 'button' ? 'Buy Now / Get Recipe Ingredients' : 'Official Website'}
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  URL Link *
                </label>
                <input
                  type="url"
                  value={buttonLink}
                  onChange={(e) => setButtonLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
            </div>
          ) : selectedType === 'tagCategoryItem' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Tag Category *
                </label>
                {tagCategoryNames.length > 0 ? (
                  <select
                    value={tagCategory}
                    onChange={(e) => setTagCategory(e.target.value)}
                    className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  >
                    {tagCategoryNames.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={tagCategory}
                    onChange={(e) => setTagCategory(e.target.value)}
                    placeholder="e.g. Cuisine, Meal Type, Diet, Category, Pros, Cons"
                    className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Tag Value *
                </label>
                <input
                  type="text"
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  placeholder="e.g. Italian, Pasta, Dinner"
                  autoFocus
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
            </div>
          ) : selectedType === 'featureList' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Feature Name (Key) *
                </label>
                <input
                  type="text"
                  value={featureKey}
                  onChange={(e) => setFeatureKey(e.target.value)}
                  placeholder="e.g. Material, Capacity, Finish"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Feature Value *
                </label>
                <input
                  type="text"
                  value={featureVal}
                  onChange={(e) => setFeatureVal(e.target.value)}
                  placeholder="e.g. Cast Iron, 5.5 Quart"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
            </div>
          ) : selectedType === 'option' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Option Category *
                </label>
                <input
                  type="text"
                  value={optionCategory}
                  onChange={(e) => setOptionCategory(e.target.value)}
                  placeholder="e.g. Color, Size, Style"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Option Value *
                </label>
                <input
                  type="text"
                  value={optionValue}
                  onChange={(e) => setOptionValue(e.target.value)}
                  placeholder="e.g. Flame, 5.5 Qt"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Position
                </label>
                <input
                  type="number"
                  value={optionPosition}
                  onChange={(e) => setOptionPosition(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Option Image URL (optional)
                </label>
                <input
                  type="text"
                  value={optionImage}
                  onChange={(e) => setOptionImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
            </div>
          ) : selectedType === 'identifier' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  ID Type *
                </label>
                <select
                  value={identifierType}
                  onChange={(e) => setIdentifierType(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                >
                  <option value="ASIN">ASIN</option>
                  <option value="ISBN-13">ISBN-13</option>
                  <option value="ISBN-10">ISBN-10</option>
                  <option value="UPC">UPC</option>
                  <option value="EAN">EAN</option>
                  <option value="SKU">SKU</option>
                  <option value="Instacart">Instacart</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Identifier Value *
                </label>
                <input
                  type="text"
                  value={identifierVal}
                  onChange={(e) => setIdentifierVal(e.target.value)}
                  placeholder="e.g. B000N501BK"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 font-mono text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
            </div>
          ) : selectedType === 'productWeight' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Weight Value *
                </label>
                <input
                  type="number"
                  step="any"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  placeholder="11.3"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Unit *
                </label>
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                >
                  {['lb', 'oz', 'kg', 'gm', 'mg'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : selectedType === 'size' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Length *</label>
                <input
                  type="number"
                  step="any"
                  value={sizeLength}
                  onChange={(e) => setSizeLength(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Width *</label>
                <input
                  type="number"
                  step="any"
                  value={sizeWidth}
                  onChange={(e) => setSizeWidth(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Depth *</label>
                <input
                  type="number"
                  step="any"
                  value={sizeDepth}
                  onChange={(e) => setSizeDepth(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Unit *</label>
                <select
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px]"
                >
                  {['in', 'cm', 'mm', 'ft', 'm'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : selectedType === 'status' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  Object Status *
                </label>
                <select
                  value={statusTitle}
                  onChange={(e) => setStatusTitle(e.target.value)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px]"
                >
                  {['active', 'unavailable', 'relisted', 'NSFW', 'flagged', 'protected'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {statusTitle === 'relisted' ? (
                <div>
                  <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                    Relisted Target Object ID *
                  </label>
                  <ObjectRefPicker value={statusLink} onChange={setStatusLink} />
                </div>
              ) : null}
            </div>
          ) : selectedType === 'ingredients' ? (
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                Recipe Ingredients (one per line) *
              </label>
              <textarea
                rows={7}
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder={'1 lb spaghetti\n6 oz guanciale or pancetta\n4 large egg yolks\n1 cup Pecorino Romano, freshly grated\nFreshly ground black pepper'}
                className="w-full rounded-[4px] border border-[#d9d9d9] p-3 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
              />
            </div>
          ) : selectedType === 'sortCustom' ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                  List Sort Mode
                </label>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                  className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px]"
                >
                  <option value="custom">Custom manual order</option>
                  <option value="reverse_recency">Newest first (reverse_recency)</option>
                  <option value="recency">Oldest first (recency)</option>
                  <option value="by-name-asc">Alphabetical A–Z (by-name-asc)</option>
                  <option value="by-name-desc">Alphabetical Z–A (by-name-desc)</option>
                </select>
              </div>
              {listCatalogItems.length > 0 ? (
                <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] p-2">
                  {sortIncludeIds.map((id, idx) => {
                    const item = listCatalogItems.find((x) => x.object_id === id);
                    const included = !sortExcludeIds.includes(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 text-[12px] shadow-2xs"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSortExcludeIds((prev) => prev.filter((x) => x !== id));
                              } else {
                                setSortExcludeIds((prev) => [...prev, id]);
                              }
                            }}
                            className="accent-[#af3d36]"
                          />
                          <span className="truncate font-medium text-[#303540]">
                            {item ? getObjectDisplayName(item) : id}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-[#8c8c8c]">
                            ({item?.object_type ?? 'item'})
                          </span>
                        </label>
                        {sortMode === 'custom' ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveSortItem(idx, -1)}
                              className="cursor-pointer rounded border border-[#d9d9d9] px-1.5 py-0.5 text-[11px] hover:border-[#af3d36] disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={idx === sortIncludeIds.length - 1}
                              onClick={() => moveSortItem(idx, 1)}
                              className="cursor-pointer rounded border border-[#d9d9d9] px-1.5 py-0.5 text-[11px] hover:border-[#af3d36] disabled:opacity-40"
                            >
                              ↓
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-[#8c8c8c]">No list items to sort yet.</p>
              )}
            </div>
          ) : selectedType === 'geo' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={geoLat}
                  onChange={(e) => setGeoLat(e.target.value)}
                  placeholder="49.2827"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold text-[#303540]">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={geoLon}
                  onChange={(e) => setGeoLon(e.target.value)}
                  placeholder="-123.1207"
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px]"
                />
              </div>
            </div>
          ) : meta.value_kind === 'object_ref' ? (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#303540]">
                {meta.label} Reference *
              </label>
              <ObjectRefPicker
                value={textValue}
                onChange={setTextValue}
                appliesTo={meta.applies_to}
              />
            </div>
          ) : meta.value_kind === 'user_ref' ? (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#303540]">
                {meta.label} Account *
              </label>
              <UserRefPicker value={textValue} onChange={setTextValue} />
            </div>
          ) : meta.value_kind === 'json' ? (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#303540]">
                {meta.label} (JSON) *
              </label>
              <textarea
                rows={6}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className="w-full rounded-[4px] border border-[#d9d9d9] p-3 font-mono text-[12px] text-[#303540] outline-none focus:border-[#af3d36]"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#303540]">
                {meta.label} *
              </label>
              {selectedType === 'description' ||
              selectedType === 'pageContent' ||
              selectedType === 'htmlContent' ||
              textValue.length > 80 ? (
                <textarea
                  rows={6}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={`Enter ${meta.label.toLowerCase()}...`}
                  className="w-full rounded-[4px] border border-[#d9d9d9] p-3 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              ) : (
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={
                    selectedType === 'aggregateRating'
                      ? 'e.g. Rating, Quality, Value'
                      : selectedType === 'tagCategory'
                        ? 'e.g. Cuisine, Meal Type, Diet, Pros, Cons'
                        : selectedType === 'price'
                          ? 'e.g. $24.99'
                          : selectedType === 'cookTime'
                            ? 'e.g. 25 mins'
                            : selectedType === 'calories'
                              ? 'e.g. 480 kcal'
                              : `Enter ${meta.label.toLowerCase()}...`
                  }
                  className="w-full rounded-[4px] border border-[#d9d9d9] px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                />
              )}
            </div>
          )}

          {/* Locale Selector */}
          {meta.localizable ? (
            <div>
              <label className="mb-1 block text-[12px] font-bold text-[#303540]">
                Language / Locale
              </label>
              <select
                value={localeInput}
                onChange={(e) => setLocaleInput(e.target.value)}
                disabled={submitting}
                className="w-full rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-2 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[4px] border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          ) : null}

          {txId ? (
            <div className="rounded-[4px] border border-[#2e7d32]/30 bg-[#edf7ed] px-3 py-2.5 text-[12px] text-[#1e4620]">
              ✓ Update broadcasted! Transaction ID: <code className="font-mono">{txId}</code>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[#efefef] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="cursor-pointer rounded-[4px] border border-[#d9d9d9] bg-white px-4 py-2 text-[13px] font-medium text-[#595959] hover:bg-[#f5f5f5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer rounded-[4px] bg-[#af3d36] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#96322c] disabled:opacity-50"
            >
              {submitting ? 'Signing with Keychain...' : 'Submit Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. UPDATE CARD (Matches open-infrastructure UpdateCard 1:1)
// ============================================================================

function UpdateCard({
  item,
  onVoted,
}: {
  item: ObjectUpdateItem;
  onVoted?: () => void;
}) {
  const { username, broadcast } = useWallet();
  const [optimisticVote, setOptimisticVote] = useState<'for' | 'against' | null>(
    item.viewer_vote ?? null,
  );
  const [forCount, setForCount] = useState(item.for_vote_count ?? 0);
  const [againstCount, setAgainstCount] = useState(item.against_vote_count ?? 0);
  const [pending, setPending] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticVote(item.viewer_vote ?? null);
    setForCount(item.for_vote_count ?? 0);
    setAgainstCount(item.against_vote_count ?? 0);
  }, [item.update_id, item.viewer_vote, item.for_vote_count, item.against_vote_count]);

  const handleVote = async (vote: 'for' | 'against') => {
    if (!username) {
      openLoginModal();
      return;
    }
    if (pending || optimisticVote === vote) return;
    setPending(true);
    setError(null);
    try {
      const op = buildOdlUpdateVoteOp({
        id: getHiveCustomJsonId(),
        updateId: item.update_id,
        objectId: item.object_id,
        voter: username,
        vote,
        required_posting_auths: [username],
      });
      await broadcast([op]);
      if (vote === 'for') {
        setForCount((c) => c + 1);
        if (optimisticVote === 'against') setAgainstCount((c) => Math.max(0, c - 1));
      } else {
        setAgainstCount((c) => c + 1);
        if (optimisticVote === 'for') setForCount((c) => Math.max(0, c - 1));
      }
      setOptimisticVote(vote);
      onVoted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setPending(false);
    }
  };

  const approvePercent = typeof item.approve_percent === 'number' ? item.approve_percent : 100;
  const meetsThreshold = approvePercent > 70;
  const privileged = item.decisive_privileged_vote;
  const txId = item.transaction_id?.trim() ?? '';
  const isRealHiveTx = /^[0-9a-f]{40}$/i.test(txId);

  const formattedJson =
    item.value_json != null
      ? typeof item.value_json === 'string'
        ? item.value_json
        : JSON.stringify(item.value_json, null, 2)
      : null;

  return (
    <article className="rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
      {/* Header: Creator avatar, @username, weight badge, timestamp */}
      <header className="flex flex-wrap items-center gap-2.5">
        <Link href={`/@${encodeURIComponent(item.creator)}`} className="shrink-0">
          <img
            src={
              item.creator_avatar_url ||
              `https://images.hive.blog/u/${encodeURIComponent(item.creator)}/avatar/small`
            }
            alt={item.creator}
            className="h-10 w-10 rounded-full border border-[#e9e7e7] object-cover"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Link
            href={`/@${encodeURIComponent(item.creator)}`}
            className="truncate text-[14px] font-semibold text-[#303540] hover:text-[#af3d36] hover:underline"
          >
            {item.creator}
          </Link>
          {typeof item.creator_wobjects_weight === 'number' &&
          item.creator_wobjects_weight > 0 ? (
            <span className="rounded bg-[#f2f2f2] px-1.5 py-0.5 text-[11px] font-semibold text-[#595959] tabular-nums">
              {Math.round(item.creator_wobjects_weight)}
            </span>
          ) : null}
          <span className="text-[12px] text-[#8c8c8c]">·</span>
          <time className="text-[12px] text-[#8c8c8c]">
            {formatUnixRelativeTime(item.created_at_unix)}
          </time>
        </div>
      </header>

      {/* Field Label + Raw JSON toggle + Locale badge */}
      <div className="mt-3 border-t border-[#efefef] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#303540]">
            {labelForUpdateType(item.update_type)}
          </h3>
          <span className="rounded bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-[11px] text-[#8c8c8c]">
            {item.update_type}
          </span>
          {formattedJson ? (
            <button
              type="button"
              onClick={() => setShowRawJson((v) => !v)}
              className="cursor-pointer rounded border border-[#d9d9d9] bg-[#fafafa] px-2 py-0.5 text-[11px] font-medium text-[#595959] hover:border-[#af3d36] hover:text-[#af3d36]"
            >
              {showRawJson ? 'Hide JSON' : 'Raw JSON'}
            </button>
          ) : null}
          {item.locale ? (
            <span className="ml-auto shrink-0 rounded-[4px] border border-[#e5e5e5] bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#595959]">
              {item.locale}
            </span>
          ) : null}
        </div>

        {showRawJson && formattedJson ? (
          <pre className="mt-2 max-h-60 overflow-auto rounded-[4px] border border-[#e8e8e8] bg-[#fafafa] p-2.5 font-mono text-[11px] text-[#303540]">
            {formattedJson}
          </pre>
        ) : null}
      </div>

      {/* Image previews */}
      {Array.isArray(item.image_preview_urls) && item.image_preview_urls.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.image_preview_urls.map((src, i) => (
            <div
              key={`${item.update_id}-img-${i}`}
              className="overflow-hidden rounded-[4px] border border-[#e5e5e5] bg-[#fafafa]"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="max-h-56 max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Value Display */}
      {item.value_text || (!item.image_preview_urls?.length && formattedJson) ? (
        <div className="mt-3 border-t border-[#efefef] pt-3 text-[13px] leading-relaxed text-[#303540]">
          {item.value_text ? (
            UPDATE_FIELD_REGISTRY[item.update_type]?.value_kind === 'object_ref' ? (
              <Link
                href={`/object/${encodeURIComponent(item.value_text)}`}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 font-medium text-[#af3d36] hover:underline"
              >
                <span>#{item.value_text}</span>
              </Link>
            ) : UPDATE_FIELD_REGISTRY[item.update_type]?.value_kind === 'user_ref' ? (
              <Link
                href={`/@${encodeURIComponent(item.value_text)}`}
                className="font-medium text-[#af3d36] hover:underline"
              >
                @{item.value_text}
              </Link>
            ) : (
              <div className="whitespace-pre-line break-words">{item.value_text}</div>
            )
          ) : formattedJson ? (
            <pre className="max-h-48 overflow-auto rounded-[4px] bg-[#fafafa] p-2.5 font-mono text-[12px] text-[#303540]">
              {formattedJson}
            </pre>
          ) : null}
        </div>
      ) : null}

      {/* Approval Status & Vote Controls */}
      <div className="mt-3 border-t border-[#efefef] pt-3">
        {txId ? (
          <div className="mb-2 flex flex-wrap items-baseline gap-2 text-[12px]">
            <span className="text-[#595959]">Transaction:</span>
            {isRealHiveTx ? (
              <a
                href={`https://hivehub.dev/tx/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-mono text-[#af3d36] hover:underline"
              >
                {txId}
              </a>
            ) : (
              <span className="truncate font-mono text-[#8c8c8c]">{txId}</span>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-[#303540]">Approval:</span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
              meetsThreshold
                ? 'border-[#2e7d32]/30 bg-[#edf7ed] text-[#2e7d32]'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {approvePercent.toFixed(2)}%
          </span>
          {privileged ? (
            <span className="flex items-center gap-1.5 text-[12px] text-[#595959]">
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  privileged.vote === 'for'
                    ? 'border-[#2e7d32]/30 bg-[#edf7ed] text-[#2e7d32]'
                    : 'border-red-300 bg-red-50 text-red-700'
                }`}
              >
                {privileged.vote === 'for' ? 'Approved' : 'Rejected'}
              </span>
              <span>
                by {privileged.tier}{' '}
                <Link
                  href={`/@${encodeURIComponent(privileged.voter)}`}
                  className="font-medium text-[#af3d36] hover:underline"
                >
                  @{privileged.voter}
                </Link>
              </span>
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-[11px] text-[#8c8c8c]">Min. 70% required</p>

        <div className="mt-2.5 flex items-center gap-4">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleVote('for')}
              className={`cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold transition-colors disabled:opacity-50 ${
                optimisticVote === 'for'
                  ? 'text-[#2e7d32]'
                  : 'text-[#595959] hover:text-[#2e7d32]'
              }`}
            >
              Approve
            </button>
            {forCount > 0 ? (
              <span
                title={item.for_preview_voters?.join(', ')}
                className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[11px] font-semibold text-[#595959]"
              >
                {forCount}
              </span>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleVote('against')}
              className={`cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold transition-colors disabled:opacity-50 ${
                optimisticVote === 'against'
                  ? 'text-red-600'
                  : 'text-[#595959] hover:text-red-600'
              }`}
            >
              Reject
            </button>
            {againstCount > 0 ? (
              <span
                title={item.against_preview_voters?.join(', ')}
                className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[11px] font-semibold text-[#595959]"
              >
                {againstCount}
              </span>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-1.5 text-[11px] text-red-600">{error}</p> : null}
      </div>
    </article>
  );
}

// ============================================================================
// 6. RIGHT RAIL: OBJECT PREVIEW & SEMANTIC COMPLETENESS HEALTH PANEL
// ============================================================================

function ObjectEditRightRail({
  objectData,
  onQuickAddField,
}: {
  objectData: ProjectedObjectWithCounts;
  onQuickAddField: (updateType: string) => void;
}) {
  const [previewTab, setPreviewTab] = useState<'preview' | 'seo' | 'jsonld'>('preview');

  const name = getObjectDisplayName(objectData);
  const title = getObjectTitle(objectData) ?? '';
  const description = getObjectDescription(objectData) ?? '';
  const avatarUrl = getObjectAvatarUrl(objectData);
  const fields = objectData.fields ?? {};

  const completeness = useMemo(() => {
    const hasName = Boolean(typeof fields.name === 'string' && fields.name.trim());
    const hasDesc = Boolean(description.length > 0);
    const hasLongDesc = description.length >= 80;
    const hasTitle = Boolean(title.length > 0);
    const hasImage = Boolean(avatarUrl);
    const hasGallery =
      (Array.isArray(fields.imageGalleryItem) && fields.imageGalleryItem.length > 0) ||
      (Array.isArray(objectData.previewGallery) && objectData.previewGallery.length > 1);
    const hasTags =
      Array.isArray(fields.tagCategoryItem) && fields.tagCategoryItem.length > 0;
    const hasCategory =
      (Array.isArray(fields.category) && fields.category.length > 0) ||
      (Array.isArray(fields.departments) && fields.departments.length > 0);
    const hasRating =
      Array.isArray(fields.aggregateRating) && fields.aggregateRating.length > 0;

    const identityScore = (hasName ? 40 : 0) + (hasLongDesc ? 40 : hasDesc ? 25 : 0) + (hasTitle ? 20 : 0);
    const mediaScore = (hasImage ? 65 : 0) + (hasGallery ? 35 : 0);
    const seoScore = (hasLongDesc ? 40 : hasDesc ? 20 : 0) + (hasTags ? 30 : 0) + (hasCategory ? 30 : 0);
    const discoverScore = (hasTags ? 60 : 0) + (hasRating ? 40 : 0);

    const dims = [
      {
        id: 'identity',
        label: 'Identity',
        score: identityScore,
        missing: [
          ...(!hasName ? ['name'] : []),
          ...(!hasDesc ? ['description'] : []),
          ...(!hasTitle ? ['title'] : []),
        ],
      },
      {
        id: 'media',
        label: 'Media',
        score: mediaScore,
        missing: [
          ...(!hasImage ? ['image'] : []),
          ...(!hasGallery ? ['imageGalleryItem'] : []),
        ],
      },
      {
        id: 'seo',
        label: 'SEO',
        score: seoScore,
        missing: [
          ...(!hasLongDesc ? ['description'] : []),
          ...(!hasTags ? ['tagCategoryItem'] : []),
        ],
      },
      {
        id: 'discoverability',
        label: 'Discoverability',
        score: discoverScore,
        missing: [
          ...(!hasTags ? ['tagCategory', 'tagCategoryItem'] : []),
          ...(!hasRating ? ['aggregateRating'] : []),
        ],
      },
    ];

    const overall = Math.round(dims.reduce((acc, d) => acc + d.score, 0) / dims.length);
    return { dims, overall };
  }, [avatarUrl, description, fields, objectData.previewGallery, title]);

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type':
        objectData.object_type === 'recipe'
          ? 'Recipe'
          : objectData.object_type === 'product'
            ? 'Product'
            : objectData.object_type === 'book'
              ? 'Book'
              : 'Thing',
      '@id': objectData.object_id,
      name,
      ...(description ? { description } : {}),
      ...(avatarUrl ? { image: avatarUrl } : {}),
    }),
    [avatarUrl, description, name, objectData.object_id, objectData.object_type],
  );

  return (
    <aside className="flex w-full min-w-0 flex-col gap-5 lg:sticky lg:top-[76px]">
      {/* Object Preview Panel */}
      <section className="rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
        <nav className="flex flex-wrap items-center gap-1 border-b border-[#efefef] pb-2.5">
          {(
            [
              { id: 'preview', label: 'Object Data' },
              { id: 'seo', label: 'SEO' },
              { id: 'jsonld', label: 'JSON-LD' },
            ] as const
          ).map((step, idx) => (
            <span key={step.id} className="flex items-center gap-1">
              {idx > 0 ? <span className="text-[11px] text-[#8c8c8c]">›</span> : null}
              <button
                type="button"
                onClick={() => setPreviewTab(step.id)}
                className={`cursor-pointer rounded-[4px] px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  previewTab === step.id
                    ? 'bg-[#af3d36] text-white'
                    : 'text-[#595959] hover:bg-[#f5f5f5]'
                }`}
              >
                {step.label}
              </button>
            </span>
          ))}
        </nav>

        <div className="mt-3">
          {previewTab === 'preview' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#f2f2f2] px-2.5 py-0.5 text-[11px] font-semibold text-[#595959] uppercase">
                  {objectData.object_type}
                </span>
                <span className="truncate font-mono text-[11px] text-[#8c8c8c]">
                  /object/{objectData.object_id}
                </span>
              </div>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  className="max-h-44 w-full rounded-[4px] border border-[#efefef] object-cover"
                />
              ) : (
                <div className="flex h-36 items-center justify-center rounded-[4px] bg-[#fafafa] text-[12px] text-[#8c8c8c]">
                  No avatar image
                </div>
              )}
              <h3 className="text-[16px] font-bold text-[#303540]">{name}</h3>
              {title ? <p className="text-[12px] text-[#595959]">{title}</p> : null}
              {description ? (
                <p className="line-clamp-4 text-[12px] leading-relaxed text-[#595959]">
                  {description}
                </p>
              ) : (
                <p className="text-[12px] italic text-[#8c8c8c]">No description yet</p>
              )}
            </div>
          ) : previewTab === 'seo' ? (
            <div className="space-y-2 rounded-[4px] border border-[#e5e5e5] bg-[#fafafa] p-3">
              <p className="truncate text-[14px] font-semibold text-[#af3d36]">{name}</p>
              <p className="truncate font-mono text-[11px] text-[#2e7d32]">
                hivecooking.com › object › {objectData.object_id}
              </p>
              <p className="line-clamp-3 text-[12px] text-[#595959]">
                {description || 'No meta description provided for this object.'}
              </p>
            </div>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-[4px] bg-[#fafafa] p-2.5 font-mono text-[11px] text-[#303540]">
              {JSON.stringify(jsonLd, null, 2)}
            </pre>
          )}
        </div>
      </section>

      {/* Semantic Completeness / Object Health Panel */}
      <section className="rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
        <h2 className="text-[15px] font-bold text-[#303540]">Object Completeness</h2>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-bold text-[#303540]">{completeness.overall}%</span>
            <span className="text-[11px] text-[#8c8c8c]">Overall health</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#efefef]">
            <div
              className="h-full rounded-full bg-[#af3d36] transition-all"
              style={{ width: `${completeness.overall}%` }}
            />
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {completeness.dims.map((dim) => {
            const ratingLabel =
              dim.score >= 85
                ? 'Excellent'
                : dim.score >= 60
                  ? 'Good'
                  : dim.score >= 35
                    ? 'Medium'
                    : 'Needs work';
            return (
              <li
                key={dim.id}
                className="rounded-[4px] border border-[#f0f0f0] bg-[#fafafa] px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#303540]">{dim.label}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      dim.score >= 60
                        ? 'border-[#af3d36]/30 bg-[#af3d36]/10 text-[#af3d36]'
                        : 'border-[#d9d9d9] bg-white text-[#8c8c8c]'
                    }`}
                  >
                    {ratingLabel}
                  </span>
                </div>
                {dim.missing.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dim.missing.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onQuickAddField(m)}
                        className="cursor-pointer rounded border border-[#d9d9d9] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#af3d36] hover:border-[#af3d36]"
                      >
                        + {labelForUpdateType(m)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

// ============================================================================
// 7. FULL 3-COLUMN WAIVIODEV.COM OBJECT EDIT MODE SHELL
// ============================================================================

export function ObjectEditModeShell({
  objectData,
  sortedListItems,
  posts,
  onExitEditMode,
  onObjectUpdated,
  onWriteReview,
}: {
  objectData: ProjectedObjectWithCounts;
  sortedListItems: ResolvedListItem[];
  posts: FeedPostItem[];
  onExitEditMode: () => void;
  onObjectUpdated: () => void;
  onWriteReview: () => void;
}) {
  const { username, broadcast } = useWallet();
  const displayName = getObjectDisplayName(objectData);
  const subtitle = getObjectTitle(objectData);
  const avatarUrl = getObjectAvatarUrl(objectData);
  const backgroundUrl =
    typeof objectData.fields?.imageBackground === 'string' &&
    objectData.fields.imageBackground.trim()
      ? objectData.fields.imageBackground.trim()
      : typeof objectData.fields?.background === 'string' && objectData.fields.background.trim()
        ? objectData.fields.background.trim()
        : null;

  const supportedUpdateTypes = useMemo(
    () => getSupportedUpdatesForType(objectData.object_type),
    [objectData.object_type],
  );

  const tagCategoryNames = useMemo(
    () => extractTagCategoryNames(objectData.fields),
    [objectData.fields],
  );
  const galleryAlbumNames = useMemo(
    () => extractGalleryAlbumNames(objectData.fields),
    [objectData.fields],
  );

  const [activeTab, setActiveTab] = useState<'updates' | 'reviews' | 'gallery' | 'followers'>(
    'updates',
  );
  const [filterUpdateType, setFilterUpdateType] = useState<string>('');
  const [filterLocale, setFilterLocale] = useState<string>('');
  const [filterSort, setFilterSort] = useState<'recency' | 'approval'>('recency');

  const [updates, setUpdates] = useState<ObjectUpdateItem[]>([]);
  const [updatesCursor, setUpdatesCursor] = useState<string | null>(null);
  const [updatesHasMore, setUpdatesHasMore] = useState(false);
  const [loadingUpdates, setLoadingUpdates] = useState(true);

  const [followers, setFollowers] = useState<
    Array<{ name: string; displayName?: string; avatarUrl?: string | null; wobjectsWeight?: number }>
  >([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);

  const [isFollowing, setIsFollowing] = useState(Boolean(objectData.is_following));
  const [isFavorited, setIsFavorited] = useState(Boolean(objectData.isFavorited));

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean;
    initialUpdateType?: string;
    initialCategory?: string;
    candidateUpdateTypes?: readonly string[];
  }>({ open: false });

  const loadUpdatesPage = useCallback(
    async (cursor: string | null = null, append = false) => {
      setLoadingUpdates(true);
      const res = await fetchObjectUpdates(objectData.object_id, {
        limit: 25,
        cursor,
        update_type: filterUpdateType || undefined,
        locale: filterLocale || undefined,
        sort: filterSort,
        include_rejected: true,
      });
      setLoadingUpdates(false);
      if (isOk(res)) {
        const nextItems = res.value.items ?? [];
        setUpdates((prev) => {
          if (!append) return nextItems;
          const seen = new Set(prev.map((i) => i.update_id));
          return [...prev, ...nextItems.filter((i) => !seen.has(i.update_id))];
        });
        setUpdatesCursor(res.value.cursor ?? null);
        setUpdatesHasMore(Boolean(res.value.hasMore));
      }
    },
    [objectData.object_id, filterUpdateType, filterLocale, filterSort],
  );

  useEffect(() => {
    void loadUpdatesPage(null, false);
  }, [loadUpdatesPage]);

  useEffect(() => {
    if (activeTab !== 'followers') return;
    setLoadingFollowers(true);
    void fetchObjectFollowers(objectData.object_id, { limit: 30 }).then((res) => {
      setLoadingFollowers(false);
      if (isOk(res)) {
        setFollowers(res.value.items ?? []);
      }
    });
  }, [activeTab, objectData.object_id]);

  const handleRefreshAfterUpdate = useCallback(() => {
    void loadUpdatesPage(null, false);
    onObjectUpdated();
  }, [loadUpdatesPage, onObjectUpdated]);

  const handleToggleFollow = async () => {
    if (!username) {
      openLoginModal();
      return;
    }
    try {
      const op = buildOdlObjectFollowOp({
        id: getHiveCustomJsonId(),
        objectId: objectData.object_id,
        method: isFollowing ? 'unfollow' : 'follow',
        required_posting_auths: [username],
      });
      await broadcast([op]);
      setIsFollowing(!isFollowing);
    } catch {
      // ignore
    }
  };

  const handleToggleFavorite = async () => {
    if (!username) {
      openLoginModal();
      return;
    }
    try {
      const op = buildOdlObjectAuthorityOp({
        id: getHiveCustomJsonId(),
        objectId: objectData.object_id,
        authorityType: 'administrative',
        method: isFavorited ? 'remove' : 'add',
        required_posting_auths: [username],
      });
      await broadcast([op]);
      setIsFavorited(!isFavorited);
    } catch {
      // ignore
    }
  };

  // Group supported fields for the Left Rail exactly like open-infrastructure
  const groupedLeftRailFields = useMemo(() => {
    const groups: Array<{ group: UpdateFieldMeta['group']; label: string; fields: UpdateFieldMeta[] }> = [];
    for (const grp of EDIT_GROUP_ORDER) {
      const matching = supportedUpdateTypes
        .map((ut) => UPDATE_FIELD_REGISTRY[ut])
        .filter((m): m is UpdateFieldMeta => Boolean(m && m.group === grp));
      if (matching.length > 0) {
        groups.push({ group: grp, label: EDIT_GROUP_LABELS[grp], fields: matching });
      }
    }
    return groups;
  }, [supportedUpdateTypes]);

  const updateTypeCounts: Record<string, number> = useMemo(() => {
    return objectData.update_type_counts ?? {};
  }, [objectData.update_type_counts]);

  const totalUpdatesCount = useMemo(() => {
    if (typeof objectData.updates_count === 'number') return objectData.updates_count;
    const sum = Object.values(updateTypeCounts).reduce((a, b) => a + b, 0);
    return sum > 0 ? sum : updates.length;
  }, [objectData.updates_count, updateTypeCounts, updates.length]);

  const renderFieldPreview = (ut: string) => {
    const f = objectData.fields ?? {};
    switch (ut) {
      case 'name':
        return displayName ? <p className="text-[13px] font-medium text-[#303540]">{displayName}</p> : null;
      case 'title':
        return subtitle ? <p className="text-[13px] text-[#303540]">{subtitle}</p> : null;
      case 'description': {
        const desc = getObjectDescription(objectData);
        if (!desc) return null;
        return (
          <p className="line-clamp-3 text-[12px] leading-relaxed text-[#595959]">
            {desc}
          </p>
        );
      }
      case 'price':
      case 'compareAtPrice':
      case 'cookTime':
      case 'calories':
      case 'nutrition':
      case 'servings':
      case 'budget':
      case 'datePublished':
      case 'inLanguage':
      case 'printLength':
      case 'typicalAgeRange':
      case 'productGroupId': {
        const val = f[ut] ?? (ut === 'cookTime' ? f.cookingTime : undefined);
        if (typeof val === 'string' || typeof val === 'number') {
          return <p className="text-[13px] font-medium text-[#303540]">{String(val)}</p>;
        }
        return null;
      }
      case 'ingredients': {
        const list = Array.isArray(f.ingredients)
          ? f.ingredients
          : Array.isArray(f.recipeIngredients)
            ? f.recipeIngredients
            : [];
        if (list.length === 0) return null;
        return (
          <ul className="list-inside list-disc space-y-0.5 text-[12px] text-[#595959]">
            {(list as unknown[]).slice(0, 5).map((item, idx) => (
              <li key={idx} className="truncate">
                {String(item)}
              </li>
            ))}
            {list.length > 5 ? (
              <li className="list-none text-[11px] text-[#8c8c8c]">
                +{list.length - 5} more ingredients
              </li>
            ) : null}
          </ul>
        );
      }
      case 'tagCategory':
      case 'tagCategoryItem': {
        if (ut === 'tagCategory' && tagCategoryNames.length > 0) {
          return (
            <div className="space-y-2">
              {tagCategoryNames.map((cat) => {
                const itemsForCat = Array.isArray(f.tagCategoryItem)
                  ? (f.tagCategoryItem as unknown[])
                      .filter(
                        (x): x is { category: string; value: string } =>
                          Boolean(x && typeof x === 'object' && (x as Record<string, unknown>).category === cat),
                      )
                      .map((x) => x.value)
                  : [];
                return (
                  <div key={cat} className="rounded-[4px] border border-[#efefef] bg-[#fafafa] p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#303540]">{cat}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setModalState({
                            open: true,
                            initialUpdateType: 'tagCategoryItem',
                            initialCategory: cat,
                            candidateUpdateTypes: ['tagCategoryItem'],
                          })
                        }
                        className="cursor-pointer text-[11px] font-semibold text-[#af3d36] hover:underline"
                      >
                        + Add tag
                      </button>
                    </div>
                    {itemsForCat.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {itemsForCat.map((tv) => (
                          <span
                            key={tv}
                            className="rounded-[4px] border border-[#af3d36]/40 bg-[#af3d36]/10 px-2 py-0.5 text-[11px] text-[#303540]"
                          >
                            {tv}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        }
        return null;
      }
      case 'listItem': {
        if (sortedListItems.length === 0) return null;
        return (
          <p className="text-[12px] text-[#595959]">
            {sortedListItems.length} items in list
          </p>
        );
      }
      case 'button': {
        const raw = f.button;
        const btns = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
        if (btns.length === 0) return null;
        return (
          <div className="space-y-1">
            {btns.map((b, i) => {
              const rec = b as { title?: string; link?: string };
              return (
                <div
                  key={i}
                  className="truncate rounded bg-[#af3d36] px-2.5 py-1 text-center text-[12px] font-semibold text-white"
                >
                  {rec.title || 'Button'}
                </div>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  // All gallery images
  const galleryPhotos: string[] = useMemo(() => {
    const urls: string[] = [];
    if (avatarUrl) urls.push(avatarUrl);
    if (Array.isArray(objectData.previewGallery)) {
      for (const g of objectData.previewGallery) {
        if (g?.url && !urls.includes(g.url)) urls.push(g.url);
      }
    }
    if (Array.isArray(objectData.fields?.imageGalleryItem)) {
      for (const raw of objectData.fields.imageGalleryItem as unknown[]) {
        if (raw && typeof raw === 'object' && 'url' in raw) {
          const u = String((raw as Record<string, unknown>).url);
          if (u && !urls.includes(u)) urls.push(u);
        }
      }
    }
    return urls;
  }, [avatarUrl, objectData.fields?.imageGalleryItem, objectData.previewGallery]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-3 py-4 sm:px-6">
      {/* 1. WAIVIODEV.COM OBJECT HERO IN EDIT MODE */}
      <header className="relative overflow-hidden rounded-[8px] border border-[#e5e5e5] bg-white shadow-2xs">
        {/* Cover Banner Band */}
        <div
          className="relative h-28 w-full bg-gradient-to-r from-[#303540] via-[#4a2c2a] to-[#af3d36] bg-cover bg-center sm:h-36"
          style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined}
        >
          <button
            type="button"
            onClick={() =>
              setModalState({
                open: true,
                initialUpdateType: 'imageBackground',
                candidateUpdateTypes: ['imageBackground'],
              })
            }
            className="absolute top-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/60 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-xs hover:bg-black/70"
          >
            <span>+</span>
            <span>Add background</span>
          </button>
        </div>

        {/* Hero Main Row: Avatar + Title + Action Bar */}
        <div className="flex flex-col gap-4 px-5 pt-4 pb-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            {/* 96x96 Avatar with Edit Overlay */}
            <div className="group relative -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-[8px] border-2 border-white bg-[#fafafa] shadow-md">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#8c8c8c]">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setModalState({
                    open: true,
                    initialUpdateType: 'image',
                    candidateUpdateTypes: ['image'],
                  })
                }
                title="Change Avatar"
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white bg-black/60 text-lg font-bold text-white">
                  +
                </span>
              </button>
            </div>

            {/* Title, Type Badge, Weight, Subtitle */}
            <div className="min-w-0 flex-1">
              <div className="group inline-flex max-w-full flex-wrap items-center gap-2">
                <h1 className="text-[22px] leading-tight font-bold text-[#303540] sm:text-[26px]">
                  {displayName}
                </h1>
                <button
                  type="button"
                  onClick={() =>
                    setModalState({
                      open: true,
                      initialUpdateType: 'name',
                      candidateUpdateTypes: ['name'],
                    })
                  }
                  title="Edit Name"
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-[#af3d36] bg-[#af3d36]/10 text-[14px] font-bold text-[#af3d36] hover:bg-[#af3d36]/20"
                >
                  +
                </button>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[#595959]">
                <span className="rounded bg-[#f2f2f2] px-2 py-0.5 font-semibold text-[#303540] capitalize">
                  {objectData.object_type}
                </span>
                {typeof objectData.weight === 'number' ? (
                  <span className="rounded border border-[#e0e0e0] bg-[#fafafa] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#595959]">
                    ★ {Math.round(objectData.weight)}
                  </span>
                ) : null}
                <span className="font-mono text-[11px] text-[#8c8c8c]">
                  #{objectData.object_id}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                {subtitle ? (
                  <p className="text-[13px] text-[#595959]">{subtitle}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: 'title',
                        candidateUpdateTypes: ['title'],
                      })
                    }
                    className="cursor-pointer text-[12px] italic text-[#8c8c8c] hover:text-[#af3d36]"
                  >
                    + Add short title...
                  </button>
                )}
                {subtitle ? (
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: 'title',
                        candidateUpdateTypes: ['title'],
                      })
                    }
                    title="Edit Title"
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[#af3d36] bg-[#af3d36]/10 text-[12px] font-bold text-[#af3d36]"
                  >
                    +
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Action Bar: Follow, View (Exit Edit Mode), Heart */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleToggleFollow()}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                isFollowing
                  ? 'border border-[#af3d36] bg-white text-[#af3d36]'
                  : 'bg-[#af3d36] text-white hover:bg-[#96322c]'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>

            <button
              type="button"
              onClick={onExitEditMode}
              className="cursor-pointer rounded-full border-2 border-[#af3d36] bg-[#af3d36]/10 px-4 py-1.5 text-[13px] font-bold text-[#af3d36] hover:bg-[#af3d36] hover:text-white"
            >
              View
            </button>

            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              title={isFavorited ? 'Remove administrative favorite' : 'Mark as administrative favorite'}
              className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border text-[16px] transition-colors ${
                isFavorited
                  ? 'border-[#af3d36] bg-[#af3d36]/10 text-[#af3d36]'
                  : 'border-[#d9d9d9] bg-white text-[#8c8c8c] hover:border-[#af3d36] hover:text-[#af3d36]'
              }`}
            >
              ♥
            </button>
          </div>
        </div>

        {/* Hero Primary Tabs */}
        <nav className="flex gap-1 overflow-x-auto border-t border-[#efefef] px-5">
          {(
            [
              { id: 'updates', label: `Updates (${totalUpdatesCount})` },
              { id: 'reviews', label: `Reviews (${objectData.posts_count ?? posts.length})` },
              { id: 'gallery', label: `Gallery (${galleryPhotos.length})` },
              {
                id: 'followers',
                label: `Followers (${objectData.followers_count ?? followers.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer border-b-2 px-4 py-3 text-[13px] font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-[#af3d36] text-[#af3d36]'
                  : 'border-transparent text-[#595959] hover:text-[#303540]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* 2. 3-COLUMN WAIVIODEV.COM OBJECT EDIT BODY */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT RAIL: All Supported Object Fields with + Buttons & Update Counts */}
        <aside className="space-y-5 lg:col-span-3">
          <div className="rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
            {groupedLeftRailFields.map((grp) => (
              <div key={grp.group} className="mb-5 last:mb-0">
                <h3 className="mb-2.5 border-b border-[#efefef] pb-1 text-[11px] font-bold tracking-wider text-[#8c8c8c] uppercase">
                  {grp.label}
                </h3>
                <div className="space-y-3.5">
                  {grp.fields.map((field) => {
                    const count = updateTypeCounts[field.update_type] ?? 0;
                    const isActiveFilter =
                      activeTab === 'updates' && filterUpdateType === field.update_type;
                    return (
                      <div key={field.update_type} className="space-y-1.5">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setModalState({
                                open: true,
                                initialUpdateType: field.update_type,
                                candidateUpdateTypes: [field.update_type],
                              })
                            }
                            title={`Add ${field.label}`}
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#af3d36] bg-[#af3d36]/10 text-[15px] leading-none font-bold text-[#af3d36] hover:bg-[#af3d36] hover:text-white"
                          >
                            +
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-[#303540]">
                              {field.label}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('updates');
                                setFilterUpdateType(
                                  filterUpdateType === field.update_type ? '' : field.update_type,
                                );
                              }}
                              className={`mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                                isActiveFilter
                                  ? 'bg-[#af3d36] text-white'
                                  : 'bg-[#f5f5f5] text-[#595959] hover:bg-[#eaeaea] hover:text-[#303540]'
                              }`}
                            >
                              <span>
                                {count} {count === 1 ? 'update' : 'updates'}
                              </span>
                              <span>›</span>
                            </button>
                          </div>
                        </div>
                        <div className="pl-9">{renderFieldPreview(field.update_type)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER COLUMN: Active Tab Content (Updates Feed / Reviews / Gallery / Followers) */}
        <main className="min-w-0 lg:col-span-6">
          {activeTab === 'updates' ? (
            <section className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[#e5e5e5] bg-white p-2.5 shadow-2xs">
                  <select
                    value={filterUpdateType}
                    onChange={(e) => setFilterUpdateType(e.target.value)}
                    className="rounded-[4px] border border-[#d9d9d9] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#303540] outline-none focus:border-[#af3d36]"
                  >
                    <option value="">All fields ({totalUpdatesCount})</option>
                    {supportedUpdateTypes.map((ut) => (
                      <option key={ut} value={ut}>
                        {labelForUpdateType(ut)} ({updateTypeCounts[ut] ?? 0})
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterLocale}
                    onChange={(e) => setFilterLocale(e.target.value)}
                    className="rounded-[4px] border border-[#d9d9d9] bg-white px-2.5 py-1.5 text-[13px] text-[#303540] outline-none focus:border-[#af3d36]"
                  >
                    <option value="">All languages</option>
                    {(objectData.update_locales?.length
                      ? objectData.update_locales
                      : ['en-US']
                    ).map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: filterUpdateType || supportedUpdateTypes[0],
                        candidateUpdateTypes: supportedUpdateTypes,
                      })
                    }
                    className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] bg-[#af3d36] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#96322c]"
                  >
                    <span>+</span>
                    <span>Add update</span>
                  </button>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center justify-end gap-2 text-[12px] text-[#595959]">
                  <span>Sort by:</span>
                  <button
                    type="button"
                    onClick={() => setFilterSort('recency')}
                    className={`cursor-pointer rounded px-2 py-0.5 font-semibold ${
                      filterSort === 'recency'
                        ? 'bg-[#af3d36]/10 text-[#af3d36]'
                        : 'hover:text-[#303540]'
                    }`}
                  >
                    Recency
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setFilterSort('approval')}
                    className={`cursor-pointer rounded px-2 py-0.5 font-semibold ${
                      filterSort === 'approval'
                        ? 'bg-[#af3d36]/10 text-[#af3d36]'
                        : 'hover:text-[#303540]'
                    }`}
                  >
                    Approval
                  </button>
                </div>
              </div>

              {/* Updates List */}
              {loadingUpdates && updates.length === 0 ? (
                <div className="rounded-[6px] border border-[#e5e5e5] bg-white p-8 text-center text-[13px] text-[#8c8c8c]">
                  Loading object updates...
                </div>
              ) : updates.length === 0 ? (
                <div className="rounded-[6px] border border-[#e5e5e5] bg-white p-8 text-center">
                  <p className="text-[14px] text-[#595959]">
                    No updates found{filterUpdateType ? ` for ${labelForUpdateType(filterUpdateType)}` : ''}.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: filterUpdateType || supportedUpdateTypes[0],
                        candidateUpdateTypes: supportedUpdateTypes,
                      })
                    }
                    className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] bg-[#af3d36] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#96322c]"
                  >
                    + Propose first update
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {updates.map((u) => (
                    <UpdateCard
                      key={u.update_id}
                      item={u}
                      onVoted={handleRefreshAfterUpdate}
                    />
                  ))}
                  {updatesHasMore ? (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        disabled={loadingUpdates}
                        onClick={() => void loadUpdatesPage(updatesCursor, true)}
                        className="cursor-pointer rounded-[4px] border border-[#d9d9d9] bg-white px-5 py-2 text-[13px] font-semibold text-[#303540] hover:border-[#af3d36] disabled:opacity-50"
                      >
                        {loadingUpdates ? 'Loading...' : 'Load more updates'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          ) : activeTab === 'reviews' ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
                <span className="text-[14px] font-bold text-[#303540]">
                  Reviews &amp; Linked Posts ({posts.length})
                </span>
                <button
                  type="button"
                  onClick={onWriteReview}
                  className="cursor-pointer rounded-[4px] bg-[#af3d36] px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#96322c]"
                >
                  + Write a new post
                </button>
              </div>
              {posts.length === 0 ? (
                <div className="rounded-[6px] border border-[#e5e5e5] bg-white p-8 text-center text-[13px] text-[#8c8c8c]">
                  No reviews yet for this object.
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <article
                      key={`${post.author}/${post.permlink}`}
                      className="rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/@${encodeURIComponent(post.author)}`}
                          className="text-[13px] font-semibold text-[#af3d36] hover:underline"
                        >
                          @{post.author}
                        </Link>
                        <span className="text-[12px] font-bold text-[#af3d36]">
                          {post.reward?.label ?? '$0.00'}
                        </span>
                      </div>
                      <Link
                        href={`/@${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`}
                        className="mt-1 block text-[16px] font-bold text-[#303540] hover:text-[#af3d36]"
                      >
                        {post.title || post.permlink}
                      </Link>
                      {post.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-[13px] text-[#595959]">
                          {post.excerpt}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : activeTab === 'gallery' ? (
            <section className="space-y-4 rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efefef] pb-3">
                <h2 className="text-[15px] font-bold text-[#303540]">
                  Object Gallery ({galleryPhotos.length})
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: 'imageGallery',
                        candidateUpdateTypes: ['imageGallery'],
                      })
                    }
                    className="cursor-pointer rounded-[4px] border border-[#d9d9d9] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#303540] hover:border-[#af3d36]"
                  >
                    + Add album
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        initialUpdateType: 'imageGalleryItem',
                        candidateUpdateTypes: ['imageGalleryItem'],
                      })
                    }
                    className="cursor-pointer rounded-[4px] bg-[#af3d36] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#96322c]"
                  >
                    + Add photo
                  </button>
                </div>
              </div>
              {galleryPhotos.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#8c8c8c]">
                  No photos in gallery yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {galleryPhotos.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className="overflow-hidden rounded-[6px] border border-[#e5e5e5] bg-[#fafafa]"
                    >
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-3 rounded-[6px] border border-[#e5e5e5] bg-white p-4 shadow-2xs">
              <h2 className="border-b border-[#efefef] pb-2.5 text-[15px] font-bold text-[#303540]">
                Followers
              </h2>
              {loadingFollowers ? (
                <p className="py-6 text-center text-[13px] text-[#8c8c8c]">
                  Loading followers...
                </p>
              ) : followers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#8c8c8c]">
                  No followers yet.
                </p>
              ) : (
                <ul className="divide-y divide-[#efefef]">
                  {followers.map((f) => (
                    <li key={f.name} className="flex items-center justify-between py-2.5">
                      <Link
                        href={`/@${encodeURIComponent(f.name)}`}
                        className="flex items-center gap-2.5 hover:underline"
                      >
                        <img
                          src={
                            f.avatarUrl ||
                            `https://images.hive.blog/u/${encodeURIComponent(f.name)}/avatar/small`
                          }
                          alt={f.name}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <span className="text-[13px] font-semibold text-[#303540]">
                          @{f.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>

        {/* RIGHT RAIL: Object Preview & Completeness Health Panel */}
        <div className="lg:col-span-3">
          <ObjectEditRightRail
            objectData={objectData}
            onQuickAddField={(ut) =>
              setModalState({
                open: true,
                initialUpdateType: ut,
                candidateUpdateTypes: [ut],
              })
            }
          />
        </div>
      </div>

      {/* Add Update Modal */}
      <ObjectEditModal
        objectId={objectData.object_id}
        objectName={displayName}
        objectType={objectData.object_type}
        open={modalState.open}
        onClose={() => setModalState({ open: false })}
        onUpdated={handleRefreshAfterUpdate}
        initialUpdateType={modalState.initialUpdateType}
        initialCategory={modalState.initialCategory}
        candidateUpdateTypes={modalState.candidateUpdateTypes}
        tagCategoryNames={tagCategoryNames}
        galleryAlbumNames={galleryAlbumNames}
        listCatalogItems={sortedListItems}
        listSortCustom={
          objectData.fields?.sortCustom as
            | { include?: string[]; exclude?: string[]; sortType?: string }
            | null
            | undefined
        }
      />
    </div>
  );
}
