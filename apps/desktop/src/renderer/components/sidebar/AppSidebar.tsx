import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  Search,
  GitBranch,
  BarChart3,
  Settings,
  Activity
} from 'lucide-react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from '../ui/sidebar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useState, useEffect } from 'react';
import { WorkspaceSwitcher } from '../ui/WorkspaceSwitcher';
import SidebarLinks from './SidebarLinks';
import SidebarBottomNav from './SidebarBottomNav';
import logoLight from '../../assets/app-icon-light.png';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/companies',   label: 'Companies',          icon: Building2 },
  { to: '/contacts',    label: 'Contacts',           icon: Users },
  { to: '/campaigns',   label: 'Campaigns',          icon: Megaphone },
  { to: '/discovery',   label: 'Discovery',          icon: Search },
  { to: '/automation',  label: 'Automation',         icon: GitBranch },
  { to: '/reports',     label: 'Reports',            icon: BarChart3 },
  { to: '/settings',    label: 'Settings',           icon: Settings },
  { to: '/operations',  label: 'Operations Center',  icon: Activity }
] as const;

/**
 * AppSidebar — the primary navigation rail for the authenticated shell.
 *
 * Per DESIGN.md §5 Sidebar:
 *   - Width: 240px fixed
 *   - Background: bg-background (flush with canvas — not a floating card)
 *   - Border: border-r border-border-subtle
 *   - Active item: accent-muted bg + 2px orange left border (handled in SidebarLinks)
 */
export function AppSidebar({ activeWorkspace }: { activeWorkspace: any }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.ipc.invoke('electron:version' as any, undefined)
      .then((v: string) => setVersion(v))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <Sidebar
      collapsible="icon"
      className="h-screen flex flex-col shrink-0 border-r border-border-subtle bg-background transition-all duration-[--duration-base]"
    >
      <SidebarHeader className="flex flex-row items-center gap-2.5 px-3 pt-4 pb-5">
        <div className="w-7 h-7 flex items-center justify-center shrink-0 overflow-hidden">
          <img src={logoLight} className="h-6 w-6 object-contain" alt="LeadForge Logo" />
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-semibold tracking-tight text-foreground leading-none">
            LeadForge
          </p>
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <SidebarLinks key={to} to={to} label={label} Icon={Icon} />
        ))}
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-1">
        <SidebarBottomNav
          user={user}
          activeWorkspace={activeWorkspace}
          handleLogout={handleLogout}
        />
        {open && version && (
          <div className="text-[10px] text-text-disabled font-mono text-start pl-2 select-none">
            v{version}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
