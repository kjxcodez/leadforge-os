import React from 'react';
import { Calendar, MessageSquare, PlusCircle, CheckCircle, Info, Trash } from 'lucide-react';
import { motion } from 'framer-motion';

export interface TimelineEvent {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

interface TimelineViewProps {
  events: TimelineEvent[];
  isLoading?: boolean;
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
  tag_added: Info
};

const EVENT_COLORS: Record<string, string> = {
  company_created: 'bg-green-500/10 text-green-500 border-green-500/20',
  company_updated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  company_deleted: 'bg-danger/10 text-danger border-danger/20',
  contact_created: 'bg-green-500/10 text-green-500 border-green-500/20',
  contact_updated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  contact_deleted: 'bg-danger/10 text-danger border-danger/20',
  campaign_created: 'bg-green-500/10 text-green-500 border-green-500/20',
  campaign_updated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  note_added: 'bg-accent/10 text-accent border-accent/20',
  tag_added: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
};

/**
 * TimelineView renders an audit trail timeline of workspace events and actions.
 * Redesigned to use rounded-none, layout constraints and staggered framer-motion entrance animations.
 */
export function TimelineView({ events, isLoading = false }: TimelineViewProps) {
  if (isLoading) {
    return <div className="text-center text-xs text-muted-foreground py-6">Loading history...</div>;
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border-subtle rounded-none text-center bg-surface-3/10">
        <Calendar className="w-6 h-6 text-muted-foreground opacity-60 mb-2" />
        <p className="text-[10px] text-muted-foreground">No recent activity logs available.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="relative border-l border-border-subtle pl-4 ml-3 space-y-5 py-2"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.04
          }
        }
      }}
    >
      {events.map((event) => {
        const Icon = EVENT_ICONS[event.type] || Info;
        const colorClass =
          EVENT_COLORS[event.type] || 'bg-surface-3 text-muted-foreground border-border-subtle';

        return (
          <motion.div
            key={event.id}
            className="relative group"
            variants={{
              hidden: { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } }
            }}
          >
            {/* Timeline bullet */}
            <div
              className={`absolute -left-[27px] top-0.5 w-6 h-6 rounded-none border flex items-center justify-center ${colorClass} shadow-sm z-10`}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-foreground font-medium pr-10">{event.content}</p>
              <span className="text-[9px] text-muted-foreground block font-mono">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
