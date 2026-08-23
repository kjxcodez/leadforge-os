import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, ArrowRight, X, Shield, Zap, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface WhatsNewDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const CURRENT_VERSION = '1.0.0';

const RELEASE_HIGHLIGHTS = [
  {
    icon: Sparkles,
    color: 'text-primary',
    title: 'Consolidated Discovery & CRM',
    description: 'Discover target accounts, inspect provenance, and promote candidates directly into active CRM records.'
  },
  {
    icon: Zap,
    color: 'text-success',
    title: 'Precision Audiences & Outreach',
    description: 'Filter companies and contacts by location, industry, or revenue, resolve recipient snapshots, and launch sequences.'
  },
  {
    icon: Shield,
    color: 'text-info',
    title: 'Hardened Gmail API Sending',
    description: 'Execute automated outreach safely via direct Google API OAuth authentication with automatic retry handling.'
  },
  {
    icon: RefreshCw,
    color: 'text-purple-500',
    title: 'Product-First Shell Experience',
    description: 'Organized tabbed settings, actionable product notifications, and automatic background update checks.'
  }
];

export function WhatsNewDialog({ isOpen: forceOpen, onClose: forceClose }: WhatsNewDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof forceOpen === 'boolean') {
      setOpen(forceOpen);
      return;
    }

    try {
      const lastSeen = localStorage.getItem('last_whats_new_version');
      if (lastSeen !== CURRENT_VERSION) {
        setOpen(true);
      }
    } catch {}
  }, [forceOpen]);

  const handleDismiss = () => {
    try {
      localStorage.setItem('last_whats_new_version', CURRENT_VERSION);
    } catch {}
    setOpen(false);
    if (forceClose) forceClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans text-xs select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-background/60 backdrop-blur-xs"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-md bg-card border border-border-subtle rounded-none shadow-elevation-3 p-6 space-y-6"
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded-none">
                  v{CURRENT_VERSION}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider font-bold">
                  Release Highlights
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground tracking-tight">
                What's New in LeadForge OS
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Here is a summary of the latest capabilities and UX enhancements in your lead generation OS.
              </p>
            </div>

            {/* Highlights List */}
            <div className="space-y-3 pt-1">
              {RELEASE_HIGHLIGHTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-surface-3/40 border border-border-subtle/60 rounded-none"
                  >
                    <div className={`mt-0.5 shrink-0 ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-foreground text-xs">{item.title}</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-border-subtle/50">
              <span className="text-[10px] text-muted-foreground font-mono">
                LeadForge OS Baseline
              </span>
              <Button
                onClick={handleDismiss}
                size="sm"
                className="gap-1.5 rounded-none font-semibold text-xs h-8 px-4"
              >
                <span>Got it, thanks!</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
