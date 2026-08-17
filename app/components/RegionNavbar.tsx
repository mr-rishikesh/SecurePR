'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const regions = [
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'uk', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
];

export function RegionNavbar() {
  const pathname = usePathname();

  const currentRegion = regions.find(r => pathname.includes(`/${r.code}`)) || regions[0];

  return (
    <div className="border-b border-white/6 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">Region:</span>
            <span className="text-sm text-indigo-400">{currentRegion.flag} {currentRegion.name}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {regions.map((region) => {
              const isActive = currentRegion.code === region.code;
              const href = pathname.replace(`/${currentRegion.code}`, `/${region.code}`);

              return (
                <Link
                  key={region.code}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white/5 text-[#888] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {region.flag} {region.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
