import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SyncWorker } from '../sync/sync-worker';
import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  Search,
  GitBranch,
  BarChart3,
  Settings,
  Sparkles,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useUI } from '../hooks/useUI';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { UserAvatar } from '../components/ui/UserAvatar';
import { WorkspaceSwitcher } from '../components/ui/WorkspaceSwitcher';

// ---------------------------------------------------------------------------
// Navigation definition
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/discovery', label: 'Discovery', icon: Search },
  { to: '/automation', label: 'Automation', icon: GitBranch },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// AppLayout
// ---------------------------------------------------------------------------

/**
 * AppLayout is the authenticated application shell.
 * It renders the sidebar, header, and the page content area via <Outlet />.
 * All auth and workspace state is read from their respective stores.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { sidebarCollapsed, toggleSidebar } = useUI();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (workspaceId) {
      SyncWorker.start(queryClient, workspaceId);
    } else {
      SyncWorker.stop();
    }

    return () => {
      SyncWorker.stop();
    };
  }, [activeWorkspace?.id, queryClient]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  const initials = (user?.displayName || user?.name || user?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          h-screen flex flex-col shrink-0 border-r border-border-subtle bg-card
          transition-all duration-200 ease-in-out
          ${sidebarCollapsed ? 'w-[52px]' : 'w-[220px]'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-3 pt-4 pb-5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 overflow-hidden">
              <p className="text-sm font-semibold tracking-tight text-foreground leading-none">LeadForge</p>
              <WorkspaceSwitcher />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                 ${isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sunken'
                 }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`px-2 pb-4 pt-3 border-t border-border-subtle space-y-1 ${sidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center gap-2 px-1 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <UserAvatar initials={initials} size="sm" />
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate leading-tight">
                  {user?.displayName || user?.name || user?.email}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeWorkspace?.name ?? 'No workspace'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-2 px-2.5 py-1.5 w-full rounded-md text-xs
              text-muted-foreground hover:text-foreground hover:bg-sunken transition-colors
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-11 flex items-center justify-between px-4 border-b border-border-subtle bg-background/90 backdrop-blur-sm shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-sunken rounded transition-colors"
            aria-label="Toggle sidebar"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
