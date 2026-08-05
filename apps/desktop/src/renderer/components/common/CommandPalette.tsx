import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/ui-store';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  Search,
  LayoutDashboard,
  Building2,
  Users,
  Megaphone,
  GitBranch,
  BarChart3,
  Settings,
  Activity,
  UserPlus,
  Plus,
  Moon,
  Sun,
  LayoutGrid,
  Monitor
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  category: string;
  shortcut?: string[];
  action: () => void;
}

/**
 * CommandPalette — global overlay fuzzy finder.
 * Triggered by Ctrl+K / Cmd+K.
 * Supports arrow keys navigation, enter selection, categories, and theme toggling.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const { state: uiState, closeCommandPalette, toggleCommandPalette, setTheme } = useUIStore();
  const { activeWorkspace } = useWorkspace();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Global hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === 'Escape' && uiState.commandPaletteOpen) {
        e.preventDefault();
        closeCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState.commandPaletteOpen, toggleCommandPalette, closeCommandPalette]);

  // Focus input when opened
  useEffect(() => {
    if (uiState.commandPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [uiState.commandPaletteOpen]);

  // List of all static commands
  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'Overview workspace analytics & stats',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => {
        navigate('/dashboard');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-contacts',
      title: 'Go to Contacts',
      subtitle: 'Manage clients and leads database',
      icon: Users,
      category: 'Navigation',
      action: () => {
        navigate('/contacts');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-companies',
      title: 'Go to Companies',
      subtitle: 'Manage organization targets',
      icon: Building2,
      category: 'Navigation',
      action: () => {
        navigate('/companies');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-campaigns',
      title: 'Go to Campaigns Outbound',
      subtitle: 'Manage email sender profiles & automation campaigns',
      icon: Megaphone,
      category: 'Navigation',
      action: () => {
        navigate('/campaigns');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-discovery',
      title: 'Go to Lead Discovery Scraper',
      subtitle: 'Find business leads and scraper execution',
      icon: Search,
      category: 'Navigation',
      action: () => {
        navigate('/discovery');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-automation',
      title: 'Go to Automation Sequences',
      subtitle: 'Manage triggers, delay rules, and sequence builder',
      icon: GitBranch,
      category: 'Navigation',
      action: () => {
        navigate('/automation');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-reports',
      title: 'Go to Advanced Reports & Analytics',
      subtitle: 'Conversion funnel analytics & charts logs',
      icon: BarChart3,
      category: 'Navigation',
      action: () => {
        navigate('/reports');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-operations',
      title: 'Go to Operations Center',
      subtitle: 'Database diagnostics, sync logs, telemetry monitor',
      icon: Activity,
      category: 'Navigation',
      action: () => {
        navigate('/operations');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-settings',
      title: 'Go to Workspace Settings',
      subtitle: 'Workspace members, roles, cookies, and guides',
      icon: Settings,
      category: 'Navigation',
      action: () => {
        navigate('/settings');
        closeCommandPalette();
      }
    },
    {
      id: 'nav-preferences',
      title: 'Go to Personal Preferences',
      subtitle: 'Theme styles, AI model selector, telemetry options',
      icon: Settings,
      category: 'Navigation',
      action: () => {
        navigate('/preferences');
        closeCommandPalette();
      }
    },

    // Actions
    {
      id: 'action-theme-dark',
      title: 'Switch to Dark Mode',
      icon: Moon,
      category: 'Preferences',
      action: () => {
        setTheme('dark');
        closeCommandPalette();
      }
    },
    {
      id: 'action-theme-light',
      title: 'Switch to Light Mode',
      icon: Sun,
      category: 'Preferences',
      action: () => {
        setTheme('light');
        closeCommandPalette();
      }
    },
    {
      id: 'action-theme-system',
      title: 'Use System Default Theme',
      icon: LayoutGrid,
      category: 'Preferences',
      action: () => {
        setTheme('system');
        closeCommandPalette();
      }
    }
  ];

  // Filter commands by query
  const filtered = commands.filter((c) => {
    const s = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(s) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(s)) ||
      c.category.toLowerCase().includes(s)
    );
  });

  // Handle keyboard interaction inside open palette
  // Group filtered by category
  const categories: Record<string, typeof filtered> = {};
  filtered.forEach((c) => {
    if (!categories[c.category]) {
      categories[c.category] = [];
    }
    categories[c.category]!.push(c);
  });

  // Flat list reference to track activeIndex correctly across groups
  const flatFiltered = Object.values(categories).flat();

  // Handle keyboard interaction inside open palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % (flatFiltered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatFiltered.length) % (flatFiltered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flatFiltered[activeIndex];
      if (current) {
        current.action();
      }
    }
  };

  return (
    <AnimatePresence>
      {uiState.commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] font-sans text-xs">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCommandPalette}
            className="absolute inset-0 bg-background/50 backdrop-blur-sm"
          />

          {/* Palette Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-lg bg-card border border-border-subtle shadow-elevation-2 flex flex-col max-h-[380px] overflow-hidden rounded-none"
            ref={containerRef}
          >
            {/* Input field */}
            <div className="flex items-center gap-2.5 px-3.5 border-b border-border-subtle h-11 shrink-0">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or route to search..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-[13px] text-foreground placeholder-text-disabled outline-none h-full"
              />
              <kbd className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle font-mono text-[9px] text-muted-foreground select-none shrink-0 rounded-none">
                ESC
              </kbd>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-3">
              {flatFiltered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No commands or pages found.
                </div>
              ) : (
                Object.entries(categories).map(([cat, items]) => (
                  <div key={cat} className="space-y-1">
                    <div className="px-2 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                      {cat}
                    </div>
                    {items.map((item) => {
                      // Find flat index
                      const flatIdx = flatFiltered.findIndex((f) => f.id === item.id);
                      const isActive = flatIdx === activeIndex;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-none transition-colors select-none ${
                            isActive
                              ? 'bg-primary/12 border-l-2 border-primary pl-2.5'
                              : 'hover:bg-surface-3/50'
                          }`}
                        >
                          <div className={`w-6 h-6 flex items-center justify-center border shrink-0 ${
                            isActive ? 'border-primary/20 text-primary bg-primary/8' : 'border-border-subtle bg-surface-3'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-medium text-foreground text-[11px] truncate">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <span className="text-[10px] text-primary/70 font-semibold font-mono pr-1 select-none">
                              Jump ↵
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Help footer */}
            <div className="border-t border-border-subtle bg-surface-3/30 px-3.5 py-2 flex items-center justify-between text-[9px] text-muted-foreground select-none shrink-0 font-mono">
              <div className="flex gap-3">
                <span>↑↓ navigate</span>
                <span>↵ select</span>
              </div>
              <span>Command Menu (Ctrl+K)</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
