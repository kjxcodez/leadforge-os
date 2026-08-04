import { Separator } from '../components/ui/separator';
import { SidebarTrigger } from '../components/ui/sidebar';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Bell } from 'lucide-react';

interface AppHeaderProps {
  onOpenNotifications: () => void;
}

/**
 * AppHeader — the top bar of the authenticated shell.
 *
 * Height: 44px (h-11), matching the sidebar header region.
 * Background: bg-background at 92% opacity with backdrop-blur.
 * Border: border-b border-border-subtle (hairline).
 */
const AppHeader = ({ onOpenNotifications }: AppHeaderProps) => {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-subtle bg-background/92 backdrop-blur-sm shrink-0 sticky top-0 z-10 select-none">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hover:bg-surface-3 transition-colors duration-[--duration-instant]" />
        <Separator orientation="vertical" className="h-4 bg-border-subtle" />
      </div>

      <div className="flex items-center gap-1.5">
        {/* Toggle Notification Drawer */}
        <button
          onClick={onOpenNotifications}
          title="Notification History"
          className="h-7 w-7 flex items-center justify-center border border-transparent hover:border-border-subtle bg-transparent hover:bg-surface-3 transition-all duration-[--duration-instant] cursor-pointer"
        >
          <Bell className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>

        <Separator orientation="vertical" className="h-4 bg-border-subtle" />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;
