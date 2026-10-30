'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { HIVECOOKING_BANNER_URL, HIVECOOKING_LOGO_URL } from '@/config/runtime';
import { useI18n } from '@/i18n';
import { fetchSearch, type SearchResponse } from '@/modules/query-api';
import { useWallet } from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

const NAV_ITEMS = [
  { href: '/object/6nltas-recipes', matchId: '6nltas-recipes', matchPath: '/', key: 'nav.byCountry' },
  { href: '/discover-objects/recipe/', matchId: null, matchPath: '/discover-objects/recipe', key: 'nav.allRecipes' },
  { href: '/object/fmldf-influencers', matchId: 'fmldf-influencers', matchPath: null, key: 'nav.services' },
  { href: '/object/eai-hive-cooking-community', matchId: 'eai-hive-cooking-community', matchPath: '/community', key: 'nav.community' },
  { href: '/object/jvbdu-chefs', matchId: 'jvbdu-chefs', matchPath: null, key: 'nav.chefs' },
  { href: '/object/4fprjs-links', matchId: '4fprjs-links', matchPath: null, key: 'nav.links' },
  { href: '/object/4ie2uj-shop', matchId: '4ie2uj-shop', matchPath: null, key: 'nav.shop' },
] as const;

function NavTabsBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const queryId = searchParams.get('id');
  const normPath = pathname.replace(/\/$/, '') || '/';
  const objPathMatch = normPath.match(/^\/object\/([^/]+)/);
  const currentId = objPathMatch?.[1] ? decodeURIComponent(objPathMatch[1]) : queryId;

  return (
    <nav className="border-b border-[#e9e7e7] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
      <ul className="mx-auto flex max-w-container-content flex-wrap items-center justify-around gap-3 px-gutter py-0.5 sm:gap-8">
        {NAV_ITEMS.map((item) => {
          let active = false;
          if (item.matchId) {
            active =
              currentId === item.matchId ||
              (normPath === '/' && !currentId && item.matchId === '6nltas-recipes');
          }
          if (!active && item.matchPath) {
            active =
              normPath === item.matchPath ||
              (item.matchPath === '/discover-objects/recipe' && normPath === '/recipes');
          }

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                suppressHydrationWarning
                className={`inline-block border-b-2 px-2 py-2.5 text-[15px] tracking-wide text-[#af3d36] uppercase transition-opacity hover:opacity-80 ${
                  active ? 'border-[#af3d36] font-semibold' : 'border-transparent font-normal'
                }`}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SiteNav() {
  const { t } = useI18n();
  const router = useRouter();
  const { username, keychainAvailable, connect, disconnect } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetchSearch({ q, limit: 8, signal: controller.signal });
      setSearching(false);
      if (isOk(res)) {
        setSearchResults(res.value);
        setSearchOpen(true);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setSearchOpen(false);
      router.push(`/discover-objects/recipe/?q=${encodeURIComponent(q)}`);
    },
    [router, searchQuery],
  );

  const handleLoginSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoginError(null);
      setConnecting(true);
      try {
        await connect(loginInput.trim().replace(/^@/, ''));
        setLoginModalOpen(false);
      } catch (err) {
        setLoginError(err instanceof Error ? err.message : t('wallet.connectError'));
      } finally {
        setConnecting(false);
      }
    },
    [connect, loginInput, t],
  );

  return (
    <header className="bg-surface">
      {/* Top Bar: Logo + Search + Keychain Auth */}
      <div className="border-b border-[#e9e7e7] bg-white">
        <div className="mx-auto flex max-w-container-content flex-wrap items-center justify-between gap-4 px-gutter py-2">
          <Link href="/object/6nltas-recipes" className="flex items-center gap-3 shrink-0">
            <img
              src={HIVECOOKING_LOGO_URL}
              alt="HiveCooking.com"
              className="h-10 w-10 object-contain sm:h-11 sm:w-11"
            />
            <span className="text-[18px] font-normal tracking-wide text-[#af3d36] uppercase sm:text-[19px]">
              HIVECOOKING.COM
            </span>
          </Link>

          {/* Predictive Search Box */}
          <div ref={searchBoxRef} className="relative flex-1 max-w-xl">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <button
                type="submit"
                aria-label={t('explore.search')}
                className=" absolute left-3 text-[#af3d36] hover:opacity-80"
              >
                {searching ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                )}
              </button>
              <input
                type="search"
                value={searchQuery}
                onFocus={() => {
                  if (searchResults) setSearchOpen(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('header.searchPlaceholder')}
                className="w-full rounded-[4px] border border-[#af3d36] bg-white py-1.5 pr-3.5 pl-9 text-body-sm text-[#353535] placeholder:text-[#99aab5] focus:outline-none"
              />
            </form>

            {searchOpen && searchResults ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-lg">
                {searchResults.objects.length === 0 && searchResults.users.length === 0 ? (
                  <p className="p-3 text-body-sm text-fg-secondary">{t('explore.noResults')}</p>
                ) : (
                  <>
                    {searchResults.objects.map((obj) => (
                      <Link
                        key={obj.object_id}
                        href={`/object/${encodeURIComponent(obj.object_id)}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 rounded-btn px-3 py-2 hover:bg-surface-control"
                      >
                        {obj.image_url ? (
                          <img
                            src={obj.image_url}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-btn object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-accent text-xs font-bold text-accent-fg">
                            🍽️
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-fg">
                            {obj.name ?? obj.object_id}
                          </p>
                          <p className="truncate text-xs text-fg-secondary uppercase">
                            {obj.object_type}
                            {obj.parent_name ? ` · ${obj.parent_name}` : ''}
                          </p>
                        </div>
                      </Link>
                    ))}
                    {searchResults.users.map((u) => (
                      <Link
                        key={`user-${u.name}`}
                        href={`/@${encodeURIComponent(u.name)}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 rounded-btn px-3 py-2 hover:bg-surface-control"
                      >
                        {u.profile_image ? (
                          <img
                            src={u.profile_image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
                            @
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-fg">@{u.name}</p>
                          <p className="truncate text-xs text-fg-secondary">
                            User · {u.followers_count} followers
                          </p>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: Keychain Sign-in / Account */}
          <div className="flex items-center gap-3 shrink-0">
            {username ? (
              <div className="flex items-center gap-2">
                <Link
                  href={`/@${encodeURIComponent(username)}`}
                  className="rounded-btn bg-surface-control px-3 py-1.5 text-body-sm font-semibold text-fg hover:text-accent"
                >
                  @{username}
                </Link>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="rounded-btn border border-border px-2.5 py-1.5 text-xs text-fg-secondary hover:border-accent hover:text-accent"
                >
                  {t('wallet.disconnect')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
              >
                {t('wallet.connect')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Promotional Food Banner */}
      <div className="w-full overflow-hidden bg-surface-control">
        <img
          src={HIVECOOKING_BANNER_URL}
          alt="HiveCooking Banner"
          className="h-24 w-full object-cover sm:h-32 md:h-36"
        />
      </div>

      {/* Main Navigation Tabs */}
      <Suspense fallback={<div className="h-12 border-b border-border bg-surface" />}>
        <NavTabsBar />
      </Suspense>

      {/* Keychain Sign-in Modal */}
      {loginModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-section text-fg">{t('wallet.connect')}</h2>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="text-fg-secondary hover:text-fg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4">
              {!keychainAvailable ? (
                <p className="text-body-sm text-error" role="alert">
                  {t('wallet.keychainMissing')}
                </p>
              ) : null}
              <div>
                <label className="block text-body-sm text-fg-secondary" htmlFor="modal-hive-user">
                  {t('wallet.usernameLabel')}
                </label>
                <input
                  id="modal-hive-user"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="hivecooking"
                  className="mt-1 w-full rounded-btn border border-border bg-surface-control px-3 py-2 text-body text-fg"
                  autoComplete="username"
                />
              </div>
              {loginError ? (
                <p className="text-body-sm text-error" role="alert">
                  {loginError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="rounded-btn bg-secondary px-4 py-2 text-body-sm text-secondary-fg"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!keychainAvailable || connecting}
                  className="rounded-btn bg-accent px-4 py-2 text-body-sm font-semibold text-accent-fg disabled:opacity-50"
                >
                  {connecting ? t('wallet.connecting') : t('wallet.connect')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
}
