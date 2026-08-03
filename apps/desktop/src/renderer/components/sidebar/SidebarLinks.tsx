import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { NavLink } from 'react-router-dom';
import { useSidebar } from '../ui/sidebar';
import type { LucideIcon } from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * SidebarLinks — nav item with active state and tooltip in collapsed mode.
 *
 * Active state per DESIGN.md §5 Sidebar:
 *   - accent-muted (12% opacity orange) background
 *   - 2px left border in primary (orange)
 *   - text-foreground label
 *
 * Inactive: text-muted-foreground, hover: text-foreground + surface-3 bg.
 * Transition: instant (100ms) per DESIGN.md §7.
 */
const SidebarLinks = ({ to, label, Icon }: SidebarLinkProps) => {
  const { open } = useSidebar();

  const navId = to.replace('/', 'nav-').replace(/^-/, '');

  return (
    <Tooltip key={to} defaultOpen={false} disabled={open}>
      <TooltipTrigger>
        <NavLink
          key={to}
          to={to}
          id={navId}
          className={({ isActive }) =>
            [
              'flex items-center gap-2.5 rounded-[--radius-md]',
              'text-[13px] font-medium',
              'transition-colors duration-[--duration-instant]',
              'outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
              isActive
                ? [
                    'bg-primary/12 border-l-2 border-primary text-foreground',
                    'pl-[10px] pr-2.5 py-1.5' // 10px = 12px - 2px border compensation
                  ].join(' ')
                : [
                    'text-muted-foreground hover:text-foreground hover:bg-surface-3',
                    'px-2.5 py-1.5'
                  ].join(' ')
            ].join(' ')
          }
        >
          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
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
