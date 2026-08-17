import { RegionNavbar } from '@/app/components/RegionNavbar';
import type { ReactNode } from 'react';

export default async function RegionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ region: string }>;
}) {
  return (
    <>
      <RegionNavbar />
      {children}
    </>
  );
}
