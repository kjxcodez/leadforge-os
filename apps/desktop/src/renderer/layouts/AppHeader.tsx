import { Separator } from '../components/ui/separator';
import { SidebarTrigger } from '../components/ui/sidebar';
import { ThemeToggle } from '../components/ui/ThemeToggle';

/**
 * AppHeader — the top bar of the authenticated shell.
 *
 * Height: 44px (h-11), matching the sidebar header region.
 * Background: bg-background at 92% opacity with backdrop-blur — stays legible
 * as content scrolls beneath (DESIGN.md §5 Navigation).
 * Border: border-b border-border-subtle (hairline).
 */
const AppHeader = () => {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-subtle bg-background/92 backdrop-blur-sm shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hover:bg-surface-3 transition-colors duration-[--duration-instant]" />
        <Separator orientation="vertical" className="h-4 bg-border-subtle" />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;
