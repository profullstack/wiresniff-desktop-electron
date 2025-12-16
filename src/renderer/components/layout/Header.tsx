import { useAuth } from '../../providers/AuthProvider';
import { useSync } from '../../providers/SyncProvider';
import { useTheme } from '../../providers/ThemeProvider';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

/**
 * Header Component
 * Application header with window controls, search, and user menu
 */
function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const { isOnline, isSyncing, pendingChanges } = useSync();
  const { theme, setTheme } = useTheme();

  const handleMinimize = () => {
    window.electronAPI?.window.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.window.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.window.close();
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-dark-border bg-dark-surface px-4 drag-region">
      {/* Left section */}
      <div className="flex items-center gap-3 no-drag">
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="btn-ghost btn-icon"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {sidebarCollapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h10M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-accent-blue to-accent-teal p-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-full w-full text-dark-bg"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">WireSniff</span>
        </div>
      </div>

      {/* Center section - Search */}
      <div className="flex-1 max-w-xl mx-4 no-drag">
        <div className="relative">
          <input
            type="text"
            placeholder="Search requests, collections..."
            className="input w-full pl-10 pr-4 py-1.5 text-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 bg-dark-bg rounded border border-dark-border">
            <span>⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 no-drag">
        {/* Sync status */}
        {user && (
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="spinner spinner-sm" />
                <span>Syncing...</span>
              </div>
            ) : pendingChanges > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-warning">
                <div className="status-syncing" />
                <span>{pendingChanges} pending</span>
              </div>
            ) : isOnline ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="status-online" />
                <span>Synced</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="status-offline" />
                <span>Offline</span>
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn-ghost btn-icon"
          title="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>

        {/* User menu */}
        {user ? (
          <div className="relative group">
            <button className="flex items-center gap-2 btn-ghost px-2 py-1">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent-blue to-accent-teal flex items-center justify-center text-xs font-medium text-dark-bg">
                {profile?.fullName?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block dropdown-menu">
              <div className="px-3 py-2 border-b border-dark-border">
                <p className="text-sm font-medium text-white">{profile?.fullName || 'User'}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
                <span className="badge-blue mt-1">{profile?.subscriptionTier || 'Free'}</span>
              </div>
              <a href="/settings" className="dropdown-item">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </a>
              <div className="dropdown-divider" />
              <button onClick={signOut} className="dropdown-item w-full text-left text-error">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <a href="/auth/login" className="btn-primary btn-sm">
            Sign in
          </a>
        )}

        {/* Window controls (Windows/Linux) */}
        {navigator.platform.toLowerCase().includes('win') || navigator.platform.toLowerCase().includes('linux') ? (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleMinimize}
              className="btn-ghost btn-icon hover:bg-dark-border"
              title="Minimize"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button
              onClick={handleMaximize}
              className="btn-ghost btn-icon hover:bg-dark-border"
              title="Maximize"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <button
              onClick={handleClose}
              className="btn-ghost btn-icon hover:bg-error hover:text-white"
              title="Close"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default Header;