'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UserMenuProps {
  onSettingsClick?: () => void;
}

export default function UserMenu({ onSettingsClick }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  // Set mounted on client side only
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Debug: Log user object
  useEffect(() => {
    console.log('UserMenu - User object:', user);
  }, [user]);

  // Memoize display values to ensure they update when user changes
  const userInitial = useMemo(() => {
    if (!isMounted) return 'U'; // Show U during SSR and initial render
    return user?.username?.charAt(0).toUpperCase() || 'U';
  }, [user?.username, isMounted]);

  const displayName = useMemo(() => {
    if (!isMounted) return ''; // Show nothing during SSR and initial render
    return user?.username || '';
  }, [user?.username, isMounted]);

  const handleLogout = () => {
    logout();
    router.push('/signin');
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      router.push('/settings');
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-colors backdrop-blur-sm border border-white/20"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white text-sm font-medium">
            {userInitial}
          </span>
        </div>
        <span className="hidden sm:inline">{displayName}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-2 w-96 bg-white border border-neutral-200 rounded-2xl shadow-2xl z-20"
            >
              {/* User Info */}
              <div className="px-4 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-medium">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900">{user?.username}</p>
                    <p className="text-sm text-neutral-600 truncate">{user?.email}</p>
                    {user?.userId && (
                      <p className="text-xs text-neutral-500 font-mono truncate mt-0.5">
                        ID: {user.userId}
                      </p>
                    )}
                    {user?.isGuest && (
                      <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded mt-1 border border-yellow-400/30">
                        Guest Mode
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div>
                <button 
                  onClick={handleSettingsClick}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  Settings
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-neutral-200">
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}