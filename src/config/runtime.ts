export function getQueryApiUrl(): string {
  return process.env.NEXT_PUBLIC_QUERY_API_URL ?? 'https://waiviodev.com';
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
