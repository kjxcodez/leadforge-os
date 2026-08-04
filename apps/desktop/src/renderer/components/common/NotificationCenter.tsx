import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  Bell,
  X,
  PlusCircle,
  CheckCircle,
  Info,
  Trash,
  MessageSquare,
  AlertTriangle,
  Mail,
  Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const EVENT_ICONS: Record<string, any> = {
  company_created: PlusCircle,
  company_updated: CheckCircle,
  company_deleted: Trash,
  contact_created: PlusCircle,
  contact_updated: CheckCircle,
  contact_deleted: Trash,
  campaign_created: PlusCircle,
  campaign_updated: CheckCircle,
  note_added: MessageSquare,
  tag_added: Info,
  EMAIL_SEND: Mail,
  WORKFLOW_START: Zap
};

const EVENT_COLORS: Record<string, string> = {
  company_created: 'text-success',
  company_updated: 'text-info',
  company_deleted: 'text-danger',
  contact_created: 'text-success',
  contact_updated: 'text-info',
  contact_deleted: 'text-danger',
  campaign_created: 'text-success',
  campaign_updated: 'text-info',
  note_added: 'text-accent',
  tag_added: 'text-purple-500',
  EMAIL_SEND: 'text-info',
  WORKFLOW_START: 'text-primary'
};

/**
 * NotificationCenter — slide-out drawer showing dynamic workspace logs history.
 */
export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';

  // Query live activity feed logs
  const feedQuery = useQuery({
    queryKey: ['notification-feed', workspaceId],
    queryFn: async () => {
      return window.ipc.invoke('dashboard:activity-feed' as any, {
        workspaceId,
        limit: 30
      });
    },
    enabled: !!workspaceId && isOpen
  });

  const events = feedQuery.data || [];
  const isLoading = feedQuery.isLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end font-sans text-xs">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/40 backdrop-blur-xs"
          />

          {/* Slide-out Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="relative z-10 w-80 h-full bg-card border-l border-border-subtle shadow-elevation-2 flex flex-col justify-between"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0">
              <h3 className="font-bold text-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-primary" />
                Notification History
              </h3>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2 border-b border-border-subtle/50 pb-3">
                      <Skeleton className="h-3 w-2/3 rounded-none" />
                      <Skeleton className="h-2 w-1/2 rounded-none" />
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                  <Bell className="w-8 h-8 opacity-30 mb-2" />
                  <p className="font-semibold text-foreground">No recent notifications</p>
                  <p className="text-[10px] opacity-75 mt-1 max-w-[180px] leading-relaxed">
                    Actions executed within your campaigns or database logs will record here.
                  </p>
                </div>
              ) : (
                <motion.div
                  className="space-y-3"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
                >
                  {events.map((event: any, idx: number) => {
                    const Icon = EVENT_ICONS[event.type] || Info;
                    const colorClass = EVENT_COLORS[event.type] || 'text-muted-foreground';

                    return (
                      <motion.div
                        key={event.id || idx}
                        variants={{
                          hidden: { opacity: 0, x: 12 },
                          visible: { opacity: 1, x: 0, transition: { duration: 0.16, ease: 'easeOut' } }
                        }}
                        className="flex gap-2.5 pb-3 border-b border-border-subtle/40 last:border-b-0"
                      >
                        <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="font-medium text-foreground leading-relaxed break-words">
                            {event.message || event.content}
                          </p>
                          <span className="text-[9px] text-muted-foreground font-mono block select-none">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Help footer */}
            <div className="border-t border-border-subtle bg-surface-3/30 px-4 py-2 flex items-center justify-between text-[9px] text-muted-foreground select-none shrink-0 font-mono">
              <span>{events.length} logs captured</span>
              <button
                onClick={() => feedQuery.refetch()}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                Refresh Log
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
