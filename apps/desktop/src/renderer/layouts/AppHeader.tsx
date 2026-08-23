import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Separator } from '../components/ui/separator';
import { SidebarTrigger } from '../components/ui/sidebar';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Bell, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

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
  const navigate = useNavigate();
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    // 1. Fetch initial updater status
    window.ipc
      .invoke('updater:get-status' as any, undefined)
      .then((res: any) => setUpdateStatus(res))
      .catch(() => {});

    // 2. Subscribe to updater status events
    const unsub = window.ipc.on('updater:status-changed' as any, (status: any) => {
      setUpdateStatus(status);
    });

    // 3. Check unread notifications indicator
    const checkUnread = () => {
      try {
        const stored = localStorage.getItem('product_notifications_read');
        setHasUnread(!stored || JSON.parse(stored).length === 0);
      } catch {
        setHasUnread(false);
      }
    };
    checkUnread();

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const isUpdateAvailable =
    updateStatus?.status === 'available' ||
    updateStatus?.status === 'ready' ||
    updateStatus?.updateAvailable;

  return (
    <header className="h-11 flex items-center justify-between px-4 border-b border-border-subtle bg-background/92 backdrop-blur-sm shrink-0 sticky top-0 z-10 select-none">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hover:bg-surface-3 transition-colors duration-[--duration-instant]" />
        <Separator orientation="vertical" className="h-4 bg-border-subtle" />
      </div>

      <div className="flex items-center gap-2">
        {/* Top-Level Update Available Shell Indicator */}
        {isUpdateAvailable && (
          <Button
            size="sm"
            onClick={() => navigate('/settings?section=updates')}
            className="h-7 text-[10px] font-semibold gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-none cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
            <span>
              {updateStatus?.status === 'ready' ? 'Update Ready to Install' : 'Update Available'}
            </span>
          </Button>
        )}

        {/* Toggle Notification Drawer */}
        <button
          onClick={onOpenNotifications}
          title="Notifications"
          className="relative h-7 w-7 flex items-center justify-center border border-transparent hover:border-border-subtle bg-transparent hover:bg-surface-3 transition-all duration-[--duration-instant] cursor-pointer"
        >
          <Bell className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          {hasUnread && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </button>

        <Separator orientation="vertical" className="h-4 bg-border-subtle" />
        <ThemeToggle />
      </div>
    </header>
  );
};

export default AppHeader;

