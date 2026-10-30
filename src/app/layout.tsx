import type { Metadata } from 'next';

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
      <body className="flex min-h-screen flex-col bg-[#fafbfc] text-[rgba(0,0,0,0.65)] antialiased">
        <AppProviders>
          <SiteNav />
          <main className="w-full flex-1">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
