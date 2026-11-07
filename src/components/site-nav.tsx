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
  { href: '/object/eai-hive-cooking-community', matchId: 'eai-hive-cooking-community', matchPath: '/community', label: 'COMMUNITY' },
  { href: '/object/jvbdu-chefs', matchId: 'jvbdu-chefs', matchPath: null, label: 'CHEFS' },
  { href: '/object/4fprjs-links', matchId: '4fprjs-links', matchPath: null, label: 'LINKS' },
  { href: '/object/4ie2uj-shop', matchId: '4ie2uj-shop', matchPath: null, label: 'SHOP' },
] as const;

const MORE_NAV_ITEMS: readonly { href: string; label: string }[] = [];

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

        {/* MORE dropdown trigger (only rendered when > 6 items) */}
        {MORE_NAV_ITEMS.length > 0 ? (
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
        ) : null}
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

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Listen for global hivecooking:open-login events from anywhere on the site
  useEffect(() => {
    function handleOpenLogin() {
      setLoginError(null);
      setLoginModalOpen(true);
    }
    window.addEventListener('hivecooking:open-login', handleOpenLogin);
    return () => window.removeEventListener('hivecooking:open-login', handleOpenLogin);
  }, []);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
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
            <div ref={userMenuRef} className="relative flex items-center gap-2.5">
              <Link
                href="/editor"
                className="inline-flex h-[32px] items-center gap-1.5 rounded-[4px] bg-[#af3d36] px-3 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-[#93312b]"
              >
                <span>✎</span>
                <span>Write post</span>
              </Link>

              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[4px] border border-[#e0e0e0] bg-white px-2.5 py-1 text-[14px] font-medium text-[#303540] hover:border-[#af3d36]"
              >
                <img
                  src={`https://images.hive.blog/u/${encodeURIComponent(username)}/avatar`}
                  alt={username}
                  className="h-6 w-6 rounded-full border border-[#e0e0e0] object-cover"
                />
                <span>@{username}</span>
                <span className="text-[10px] text-[#8c8c8c]">▾</span>
              </button>

              <button
                type="button"
                onClick={handleToggleLocale}
                title={locale === 'en-US' ? 'Switch to Arabic' : 'Switch to English'}
                className="Topnav__link flex h-[34px] w-[28px] cursor-pointer items-center justify-center text-[#af3d36]"
              >
                <i className="iconfont icon-language !text-[22px] leading-none font-thin text-[#af3d36]" />
              </button>

              {userMenuOpen ? (
                <div className="absolute top-full right-0 z-50 mt-1.5 w-[210px] rounded-[6px] border border-[#e0e0e0] bg-white py-1.5 shadow-xl">
                  <div className="border-b border-[#efefef] px-3.5 py-2">
                    <div className="text-[13px] font-bold text-[#303540]">@{username}</div>
                    <div className="text-[11px] text-[#2e7d32]">Connected via Hive Keychain</div>
                  </div>
                  <Link
                    href={`/@${encodeURIComponent(username)}`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    👤 My Profile &amp; Blog
                  </Link>
                  <Link
                    href="/editor"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    ✎ Write Post / Review
                  </Link>
                  <Link
                    href={`/@${encodeURIComponent(username)}/transfers`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    💰 Wallet &amp; Transfers
                  </Link>
                  <Link
                    href={`/@${encodeURIComponent(username)}/favorites`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    ♥ My Favorites
                  </Link>
                  <Link
                    href={`/@${encodeURIComponent(username)}/activity`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    ⚡ Account Activity
                  </Link>
                  <Link
                    href={`/@${encodeURIComponent(username)}/permissions`}
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3.5 py-2 text-[13px] text-[#303540] hover:bg-[#fff5f4] hover:text-[#af3d36]"
                  >
                    🔑 Authorizations
                  </Link>
                  <div className="my-1 border-t border-[#efefef]" />
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      disconnect();
                    }}
                    className="block w-full cursor-pointer px-3.5 py-2 text-left text-[13px] font-medium text-[#d9534f] hover:bg-[#fff5f5]"
                  >
                    Log Out
                  </button>
                </div>
              ) : null}
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
                  <i className="iconfont icon-language ml-[5px] !text-[26px] leading-[28.8px] font-thin text-[#af3d36]" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom-Right AI Button (.BBackTop) matching hivecooking.com */}
      <div className="BBackTop fixed right-0 bottom-[60px] z-[1500] h-0">
        <div className="primary-modal BBackTop__container relative mx-[22.5px]">
          <div className="BBackTop_button-ai float-right block h-[45px] w-[45px] cursor-pointer rounded-full bg-[#af3d36] pt-[7px] pl-[10px] text-[26px] leading-[30px] font-medium text-white shadow-[2px_2px_5px_0_rgba(31,31,31,0.5)] hover:bg-[#93312b]">
            AI
          </div>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLoginModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[6px] border border-[#e9e7e7] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#303540]">{t('wallet.connect')}</h2>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="cursor-pointer text-[#99aab5] hover:text-[#353535]"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-[13px] text-[#595959]">
              Sign in with your Hive account and Hive Keychain browser extension to publish posts, comments, likes, and wallet transactions.
            </p>
            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-4">
              {!keychainAvailable ? (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900" role="alert">
                  <div className="font-semibold">{t('wallet.keychainMissing')}</div>
                  <div className="mt-1">
                    Install the{' '}
                    <a
                      href="https://hive-keychain.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#af3d36] underline"
                    >
                      Hive Keychain Extension
                    </a>{' '}
                    and refresh this page.
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-[13px] font-semibold text-[#303540]" htmlFor="modal-hive-user">
                  {t('wallet.usernameLabel')}
                </label>
                <input
                  id="modal-hive-user"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="e.g. hivecooking"
                  className="mt-1.5 w-full rounded-[4px] border border-[#d9d9d9] bg-[#fafbfc] px-3 py-2 text-[14px] text-[#353535] outline-none focus:border-[#af3d36] focus:bg-white"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {loginError ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700" role="alert">
                  {loginError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setLoginModalOpen(false)}
                  className="cursor-pointer rounded-[4px] bg-[#ececec] px-4 py-2 text-[13px] font-medium text-[#333333] hover:bg-[#e0e0e0]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!keychainAvailable || connecting || !loginInput.trim()}
                  className="cursor-pointer rounded-[4px] bg-[#af3d36] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#93312b] disabled:opacity-50"
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
