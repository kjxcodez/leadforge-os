import {
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  Search,
  GitBranch,
  BarChart3,
  Settings,
  Hexagon,
  Terminal,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "../ui/sidebar";
import { WorkspaceSwitcher } from "../ui/WorkspaceSwitcher";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import SidebarLinks from "./SidebarLinks";
import SidebarBottomNav from "./SidebarBottomNav";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/discovery", label: "Discovery", icon: Search },
  { to: "/automation", label: "Automation", icon: GitBranch },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/diagnostics", label: "Diagnostics", icon: Terminal },
];

export function AppSidebar({ activeWorkspace }: { activeWorkspace: any }) {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/auth/login", { replace: true });
  };
  return (
    <Sidebar
      collapsible="icon"
      className="h-screen flex flex-col shrink-0 border-r border-border-subtle bg-card transition-all duration-200 ease-in-out"
    >
      <SidebarHeader className="flex flex-row items-center gap-2.5 px-3 pt-4 pb-5">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
          <Hexagon
            className="h-5 w-5 text-neutral-300"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <p className="text-sm font-semibold tracking-tight text-foreground leading-none">
            LeadForge
          </p>
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 px-2 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <SidebarLinks
            key={to}
            to={to}
            label={label}
            Icon={Icon}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarBottomNav user={user} activeWorkspace={activeWorkspace} handleLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  );
}
