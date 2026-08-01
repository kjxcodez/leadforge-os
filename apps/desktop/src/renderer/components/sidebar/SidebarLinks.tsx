import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { NavLink } from 'react-router-dom';
import { useSidebar } from '../ui/sidebar';

const SidebarLinks = ({ to, label, Icon }: { to: string; label: string; Icon: any }) => {
  const { open } = useSidebar();
  return (
    <Tooltip key={to} defaultOpen={false} disabled={open}>
      <TooltipTrigger>
        <NavLink
          key={to}
          to={to}
          id={
            to === '/discovery'
              ? 'nav-discovery'
              : to === '/companies'
                ? 'nav-companies'
                : to === '/campaigns'
                  ? 'nav-campaigns'
                  : to === '/diagnostics'
                    ? 'nav-queue'
                    : to === '/settings'
                      ? 'nav-settings'
                      : undefined
          }
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
            ${
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-sunken'
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          {open ? (
            <span>{label}</span>
          ) : (
            <TooltipContent side="right">
              <span>{label}</span>
            </TooltipContent>
          )}
        </NavLink>
      </TooltipTrigger>
    </Tooltip>
  );
};

export default SidebarLinks;
