export function getQueryApiUrl(): string {
  return process.env.NEXT_PUBLIC_QUERY_API_URL ?? 'https://api.hivecooking.com';
}

export function getQueryApiVersion(): string {
  return process.env.NEXT_PUBLIC_QUERY_API_VERSION ?? '1';
}

export function getOdlNetworkId(): string {
  return process.env.NEXT_PUBLIC_ODL_NETWORK ?? 'odl-testnet';
}

export function getHiveCustomJsonId(): string {
  return process.env.NEXT_PUBLIC_HIVE_CUSTOM_JSON_ID ?? getOdlNetworkId();
}

export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? '';
}

export function getGovernanceObjectId(): string {
  return process.env.NEXT_PUBLIC_GOVERNANCE_OBJECT_ID ?? 'governance-31abe670';
}

export function getRootObjectId(): string {
  return process.env.NEXT_PUBLIC_ROOT_OBJECT_ID ?? '6nltas-recipes';
}

export function getBaseBusinessObjectId(): string {
  return process.env.NEXT_PUBLIC_BASE_BUSINESS_OBJECT_ID ?? 'ecy-hive-cooking';
}

export const HIVECOOKING_LOGO_URL =
  'https://waivio.nyc3.digitaloceanspaces.com/1710778570_5d285c15-f89b-4262-b8cc-a459ce1f8e53';

export const HIVECOOKING_BANNER_URL =
  'https://waivio.nyc3.digitaloceanspaces.com/1710780850_d2cf8133-eafd-4098-8280-49354a2e6a34';

export const HIVECOOKING_GA4_ID = 'G-60EXL40G6J';
export const HIVECOOKING_SKIMLINKS_URL = 'https://s.skimresources.com/js/291185X1778232.skimlinks.js';
