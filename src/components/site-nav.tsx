'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { HIVECOOKING_BANNER_URL, HIVECOOKING_LOGO_URL } from '@/config/runtime';
import { useI18n, type LocaleId } from '@/i18n';
import { fetchSearch, type SearchResponse } from '@/modules/query-api';
import { useWallet } from '@/modules/wallet';
import { isOk } from '@/shared/domain/result';

const PRIMARY_NAV_ITEMS = [
  { href: '/object/6nltas-recipes', matchId: '6nltas-recipes', matchPath: '/', label: 'BY COUNTRY' },
  { href: '/discover-objects/recipe/', matchId: null, matchPath: '/discover-objects/recipe', label: 'ALL RECIPES' },
  { href: '/object/6nltas-recipes', matchId: '__earn__', matchPath: '/active-campaigns/recipe', label: 'EARN!' },
  { href: '/object/fmldf-influencers', matchId: 'fmldf-influencers', matchPath: null, label: 'SERVICES' },
  { href: '/object/eai-hive-cooking-community', matchId: 'eai-hive-cooking-community', matchPath: '/community', label: 'COMMUNITY' },
] as const;

const MORE_NAV_ITEMS = [
  { href: '/object/jvbdu-chefs', label: 'CHEFS' },
  { href: '/object/4fprjs-links', label: 'LINKS' },
  { href: '/object/4ie2uj-shop', label: 'SHOP' },
] as const;

function NavTabsBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const queryId = searchParams.get('id');
  const normPath = pathname.replace(/\/$/, '') || '/';
  const objPathMatch = normPath.match(/^\/object\/([^/]+)/);
  const currentId = objPathMatch?.[1] ? decodeURIComponent(objPathMatch[1]) : queryId;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div id="WebsiteTopNavigationContainer" className="w-full">
      <nav
        id="WebsiteTopNavigation"
        className="relative z-30 flex h-[45.8px] w-full items-center justify-center border-t border-[#e9e7e7] bg-[#fafbfc] p-[10px] shadow-[0_4px_5px_0_rgba(0,0,0,0.12)]"
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          let active = false;
          if (item.matchId && item.matchId !== '__earn__') {
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
            <Link
              key={item.label}
              href={item.href}
              suppressHydrationWarning
              className="group relative inline-block h-[25px] w-[200px] cursor-pointer text-center text-[16px] leading-[24px] font-normal tracking-normal text-[#af3d36] uppercase"
            >
              <div className="h-[24px] leading-[24px]">{item.label}</div>
              <span
                className={`mx-auto block h-[1px] bg-[#af3d36] transition-all duration-300 ${
                  active ? 'w-[calc(100%-50px)]' : 'w-0 group-hover:w-[calc(100%-50px)]'
                }`}
              />
            </Link>
          );
        })}

        {/* MORE dropdown trigger (6th 200px slot) */}
        <div ref={moreRef} className="relative inline-block h-[25px] w-[200px] text-center">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-block h-[25px] w-[200px] cursor-pointer text-center text-[16px] leading-[24px] font-normal tracking-normal text-[#af3d36] uppercase"
          >
            more{' '}
            <i aria-label="icon: caret-down" className="inline-block align-[-0.125em] text-[14px]">
              <svg
                viewBox="0 0 1024 1024"
                focusable="false"
                data-icon="caret-down"
                width="1em"
                height="1em"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M840.4 300H183.6c-19.7 0-30.7 20.8-18.5 35l328.4 380.8c9.4 10.9 27.5 10.9 37 0L858.9 335c12.2-14.2 1.2-35-18.5-35z" />
              </svg>
            </i>
          </button>

          {moreOpen ? (
            <div className="absolute left-1/2 top-full z-50 mt-2 w-44 -translate-x-1/2 rounded-[4px] border border-[#e9e7e7] bg-white py-1.5 shadow-lg">
              {MORE_NAV_ITEMS.map((sub) => (
                <Link
                  key={sub.label}
                  href={sub.href}
                  onClick={() => setMoreOpen(false)}
                  className="block px-4 py-2 text-left text-[15px] font-normal text-[#af3d36] uppercase hover:bg-[#fafbfc]"
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

export function SiteNav() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { username, keychainAvailable, connect, disconnect } = useWallet();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [, setSearching] = useState(false);
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

  const handleToggleLocale = useCallback(() => {
    const next: LocaleId = locale === 'en-US' ? 'ar-SA' : 'en-US';
    window.dispatchEvent(new CustomEvent<LocaleId>('hivecooking:set-locale', { detail: next }));
  }, [locale]);

  return (
    <header className="w-full bg-[#fafbfc]">
      {/* Top Bar (.Header): 75px height, 10px padding, #fafbfc background, shadow */}
      <div className="Header relative z-40 flex h-[75px] w-full items-center justify-between bg-[#fafbfc] p-[10px] shadow-[0_4px_5px_0_rgba(0,0,0,0.12)]">
        <Link
          href="/object/6nltas-recipes"
          title="hivecooking.com"
          className="Header__logo flex items-center text-[#af3d36] uppercase"
        >
          <img
            src={HIVECOOKING_LOGO_URL}
            alt="Social Gifts - hivecooking.com"
            className="Header__img mr-[15px] h-[50px] w-[50.0625px] object-contain"
          />
          <span className="hidden text-[20px] leading-[30px] font-medium tracking-normal text-[#af3d36] uppercase md:inline">
            HIVECOOKING.COM
          </span>
        </Link>

        {/* Predictive Search Box (.Header__search) */}
        <div ref={searchBoxRef} className="Header__search relative hidden md:flex md:w-[40%] md:items-center">
          <form onSubmit={handleSearchSubmit} className="relative flex h-[32px] w-full items-center">
            <i
              aria-hidden="true"
              className="iconfont icon-search pointer-events-none absolute left-[5px] text-[20px] leading-none text-[#af3d36]"
            />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (searchResults) setSearchOpen(true);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              className="-mt-[4px] h-[32px] w-full rounded-[4px] border border-[#af3d36] bg-white py-[4px] pr-[40px] pl-[30px] text-[16px] font-normal text-[rgba(0,0,0,0.65)] placeholder:text-[#bfbfbf] focus:shadow-[0_0_5px_0_#93312b] focus:outline-none"
            />
          </form>

          {searchOpen && searchResults ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-[4px] border border-[#e9e7e7] bg-white p-2 shadow-lg">
              {searchResults.objects.length === 0 && searchResults.users.length === 0 ? (
                <p className="p-3 text-body-sm text-fg-secondary">{t('explore.noResults')}</p>
              ) : (
                <>
                  {searchResults.objects.map((obj) => (
                    <Link
                      key={obj.object_id}
                      href={`/object/${encodeURIComponent(obj.object_id)}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 rounded-[4px] px-3 py-2 hover:bg-[#fafbfc]"
                    >
                      {obj.image_url ? (
                        <img
                          src={obj.image_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-[4px] object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[#af3d36] text-xs font-bold text-white">
                          🍽️
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-[#353535]">
                          {obj.name ?? obj.object_id}
                        </p>
                        <p className="truncate text-xs text-[#99aab5] uppercase">
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
                      className="flex items-center gap-3 rounded-[4px] px-3 py-2 hover:bg-[#fafbfc]"
                    >
                      {u.profile_image ? (
                        <img
                          src={u.profile_image}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#af3d36] text-xs font-bold text-white">
                          @
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-[#353535]">@{u.name}</p>
                        <p className="truncate text-xs text-[#99aab5]">
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

        {/* Right Header Controls (.Header__rightWrap): Sign In + Language Icon */}
        <div className="Header__rightWrap flex h-[55px] items-center">
          {username ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/@${encodeURIComponent(username)}`}
                className="rounded-[4px] border border-[#e9e7e7] bg-white px-3 py-1 text-[15px] font-medium text-[#353535] hover:text-[#af3d36]"
              >
                @{username}
              </Link>
              <button
                type="button"
                onClick={() => disconnect()}
                className="rounded-[4px] border border-[#e9e7e7] px-2.5 py-1 text-xs text-[#99aab5] hover:border-[#af3d36] hover:text-[#af3d36]"
              >
                {t('wallet.disconnect')}
              </button>
            </div>
          ) : (
            <div className="Topnav__menu-container flex h-[55px] items-center">
              <div className="flex h-[55px] items-center px-[3px] ml-[5px]">
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(true)}
                  className="ModalSignIn__link-type flex h-[30px] cursor-pointer items-center rounded-[4px] border border-[#af3d36] bg-transparent px-[8px] text-[18px] font-light text-[#af3d36] capitalize"
                >
                  Sign In
                </button>
              </div>
              <div className="flex h-[55px] w-[32px] items-center justify-center px-[3px]">
                <button
                  type="button"
                  onClick={handleToggleLocale}
                  title={locale === 'en-US' ? 'Switch to Arabic' : 'Switch to English'}
                  className="Topnav__link flex h-[55px] w-[26px] cursor-pointer items-center justify-center text-[#af3d36]"
                >
                  <i className="iconfont icon-language ml-[5px] text-[28px] leading-[28.8px] font-thin text-[#af3d36]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Promotional Food Banner: exact 8:1 aspect ratio, object-fill */}
      <div className="w-full overflow-hidden">
        <img
          src={HIVECOOKING_BANNER_URL}
          alt="HiveCooking Banner"
          className="block aspect-[8/1] w-full object-fill"
        />
      </div>

      {/* Main Navigation Tabs */}
      <Suspense fallback={<div className="h-[45.8px] border-t border-[#e9e7e7] bg-[#fafbfc]" />}>
        <NavTabsBar />
      </Suspense>

      {/* Keychain Sign-in Modal */}
      {loginModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[4px] border border-[#e9e7e7] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-section text-[#353535]">{t('wallet.connect')}</h2>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="text-[#99aab5] hover:text-[#353535]"
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
                <label className="block text-body-sm text-[#657786]" htmlFor="modal-hive-user">
                  {t('wallet.usernameLabel')}
                </label>
                <input
                  id="modal-hive-user"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="hivecooking"
                  className="mt-1 w-full rounded-[4px] border border-[#e9e7e7] bg-[#fafbfc] px-3 py-2 text-body text-[#353535]"
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
                  className="rounded-[4px] bg-[#ececec] px-4 py-2 text-body-sm text-[#333333]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!keychainAvailable || connecting}
                  className="rounded-[4px] bg-[#af3d36] px-4 py-2 text-body-sm font-semibold text-white disabled:opacity-50"
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
