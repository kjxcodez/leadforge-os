import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { NavLink, useLocation } from 'react-router-dom';
import { useSidebar } from '../ui/sidebar';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface SidebarLinkProps {
  to: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * SidebarLinks — nav item with active state, animated indicator, and tooltip.
 *
 * Active state per DESIGN.md §5 Sidebar:
 *   - accent-muted (12% opacity orange) background via layoutId sliding pill
 *   - 2px left border in primary (orange)
 *   - text-foreground label
 *
 * The active background is a shared `layoutId="sidebar-pill"` Framer Motion
 * element that slides smoothly between nav items on route change.
 *
 * Inactive: text-muted-foreground, hover: text-foreground + surface-3 bg.
 */
const SidebarLinks = ({ to, label, Icon }: SidebarLinkProps) => {
  const { open } = useSidebar();
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');

  const navId = to.replace('/', 'nav-').replace(/^-/, '');

  return (
    <Tooltip key={to} defaultOpen={false} disabled={open}>
      <TooltipTrigger>
        <NavLink
          key={to}
          to={to}
          id={navId}
          className={({ isActive: linkActive }) =>
            [
              'relative flex items-center gap-2.5',
              'text-[13px] font-medium',
              'transition-colors duration-[--duration-instant]',
              'outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1',
              linkActive
                ? 'border-l-2 border-primary text-foreground pl-[10px] pr-2.5 py-1.5'
                : 'text-muted-foreground hover:text-foreground px-2.5 py-1.5'
            ].join(' ')
          }
        >
          {({ isActive: linkActive }) => (
            <>
              {/* Animated sliding background pill */}
              {linkActive && (
                <motion.span
                  layoutId="sidebar-pill"
                  className="absolute inset-0 bg-primary/12"
                  style={{ borderRadius: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              {/* Hover background for inactive items */}
              {!linkActive && (
                <span className="absolute inset-0 rounded-none bg-transparent hover:bg-surface-3 transition-colors duration-[--duration-instant]" />
              )}
              <Icon className="relative w-4 h-4 shrink-0 z-10" aria-hidden="true" />
              {open ? (
                <span className="relative z-10">{label}</span>
              ) : (
                <TooltipContent side="right">
                  <span>{label}</span>
                </TooltipContent>
              )}
            </>
          )}
        </NavLink>
      </TooltipTrigger>
    </Tooltip>
  );
};

export default SidebarLinks;
