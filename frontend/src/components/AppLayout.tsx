'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import UserMenu from './UserMenu';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);

  // Clear navigating state when pathname changes
  useEffect(() => {
    setNavigating(false);
    setOptimisticPath(null);
  }, [pathname]);

  const navItems = [
    { name: 'Home', path: '/home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Operations', path: '/operations', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { name: 'Outreach', path: '/outreach', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { name: 'Agents', path: '/agents-overview', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { name: 'Dashboard', path: '/analytics', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
    { name: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { name: 'Help', path: '/help', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const handleNavClick = (path: string) => {
    if (pathname !== path) {
      setOptimisticPath(path);
      setNavigating(true);
      router.push(path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63]">
      {/* Meridian Logo */}
      <div className="fixed top-8 left-8 z-50">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 48 48" className="drop-shadow-lg">
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
          </svg>
          <div className="text-white text-2xl font-bold">
            Meridian
          </div>
        </div>
      </div>

      {/* Navigation Sidebar */}
      <div className="fixed left-8 top-32 z-50 flex flex-col gap-3 w-[200px]">
        <div className="text-[#8FA6C1] text-xs font-medium uppercase tracking-wider mb-2">Navigation</div>
        {navItems.map((item) => {
          const isActive = (optimisticPath || pathname) === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`p-3 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isActive ? 'bg-white/20 rounded-lg' : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-[#A3B4CC]'}`}>
                  {item.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* User Menu - Bottom Left */}
      <div className="fixed bottom-4 left-4 z-50">
        <UserMenu />
      </div>

      {/* Content Area */}
      <div className="fixed left-[265px] right-0 top-0 bottom-0 overflow-hidden bg-[#14304a] border-l border-white/10">
        <div className="relative h-full overflow-y-auto overflow-x-hidden px-6 py-6">
          {navigating && (
            <div className="absolute inset-0 bg-[#14304a] border-l border-white/10 z-50 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-2xl font-semibold text-white">Loading...</p>
              </div>
            </div>
          )}
          <div className={navigating ? 'invisible' : 'visible'}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
