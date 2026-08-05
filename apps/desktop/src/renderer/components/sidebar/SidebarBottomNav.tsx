import { ChevronsUpDownIcon, Sparkles, BadgeCheck, CreditCard, Bell, LogOut, Settings } from 'lucide-react';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '../ui/sidebar';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';

const SidebarBottomNav = ({
  user,
  activeWorkspace,
  handleLogout
}: {
  user: any;
  activeWorkspace: any;
  handleLogout: () => void;
}) => {
  const { isMobile, open } = useSidebar();
  const navigate = useNavigate();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className={` ${open ? 'h-8 w-8' : 'h-6 w-6'} rounded-lg`}>
              {/* <AvatarImage src={user.avatar} alt={user.name} /> */}
              <AvatarFallback className="rounded-md bg-accent text-white font-bold">
                {user?.displayName?.charAt(0) || user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user?.displayName}</span>
              <span className="truncate text-xs">{user?.email}</span>
              <span className="text-[10px] text-muted-foreground truncate block">
                {activeWorkspace?.name ?? 'No workspace'}
              </span>
            </span>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
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
              <DropdownMenuItem disabled className="cursor-not-allowed">
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/preferences')} className="cursor-pointer">
                <Settings />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="cursor-not-allowed">
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="cursor-not-allowed">
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
  );
};

export default SidebarBottomNav;
