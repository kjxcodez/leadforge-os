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
  ChevronsUpDownIcon,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../components/ui/sidebar";
import { WorkspaceSwitcher } from "../components/ui/WorkspaceSwitcher";
import { NavLink, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/discovery", label: "Discovery", icon: Search },
  { to: "/automation", label: "Automation", icon: GitBranch },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ activeWorkspace }: { activeWorkspace: any }) {
  const { user, logout } = useAuth();
  const { open, isMobile } = useSidebar();

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
      <SidebarContent className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                 ${
                   isActive
                     ? "bg-accent/10 text-accent"
                     : "text-muted-foreground hover:text-foreground hover:bg-sunken"
                 }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {open && <span>{label}</span>}
          </NavLink>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
                    <AvatarFallback className="rounded-md bg-accent text-white font-bold">
                      {user?.displayName?.charAt(0) || user?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.displayName}
                    </span>
                    <span className="truncate text-xs">{user?.email}</span>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {activeWorkspace?.name ?? "No workspace"}
                    </p>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
                      <AvatarFallback className="rounded-md bg-accent text-white font-bold">
                        {user?.displayName?.charAt(0) || user?.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium text-foreground">
                        {user?.displayName || user?.name}
                      </span>
                      <span className="truncate text-xs">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <Sparkles />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <BadgeCheck />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <CreditCard />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Bell />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleLogout()}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
