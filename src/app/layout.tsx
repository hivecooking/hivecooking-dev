import type { Metadata } from 'next';
import Link from 'next/link';

import { AppProviders } from '@/components/app-providers';
import { SiteNav } from '@/components/site-nav';

import './globals.css';

export const metadata: Metadata = {
  title: 'HiveCooking.com — Recipes by Country & Culinary Community',
  description:
    'Explore authentic recipes by country, regional cuisines, chefs, and culinary stories powered by the Open Data Layer and Hive blockchain.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-bg text-fg antialiased">
        <AppProviders>
          <SiteNav />
          <main className="mx-auto w-full flex-1 max-w-container-content px-gutter py-section-y">
            {children}
          </main>
          <footer className="mt-12 border-t border-border bg-surface py-6 text-body-sm text-fg-secondary">
            <div className="mx-auto flex max-w-container-content flex-wrap items-center justify-between gap-4 px-gutter">
              <p>© {new Date().getFullYear()} HiveCooking.com · Powered by Open Data Layer (ODL)</p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/object/ecy-hive-cooking" className="hover:text-accent">
                  About HiveCooking
                </Link>
                <Link href="/object/governance-31abe670" className="hover:text-accent">
                  Governance
                </Link>
                <Link href="/explore/" className="hover:text-accent">
                  Search &amp; Discover
                </Link>
                <Link href="/broadcast/" className="hover:text-accent">
                  Keychain Tools
                </Link>
              </div>
            </div>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
