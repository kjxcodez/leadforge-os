import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { SidebarTrigger } from '../components/ui/sidebar';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const AppHeader = () => {
  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-subtle bg-background/90 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className={'bg-background hover:bg-foreground/10'} />
        <Separator orientation="vertical" />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;
