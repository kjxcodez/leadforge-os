import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronsUpDown, Plus, Settings, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useWorkspaceInvites } from '../../hooks/useWorkspaceQuery';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from './dropdown-menu';
import { CreateWorkspaceDialog } from './WorkspaceDialogs';

/**
 * WorkspaceSwitcher renders a dropdown in the sidebar to switch active workspaces,
 * create a new workspace, and navigate to invitations or settings.
 *
 * Design is strictly aligned with DESIGN.md §2 & §5 (Forge Orange tokens,
 * hover transitions, border-l active states matching sidebar links).
 */
export function WorkspaceSwitcher() {
  const { activeWorkspace, workspaces, setActive } = useWorkspace();
  const invitesQuery = useWorkspaceInvites();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);

  const pendingInvitesCount = invitesQuery.data?.length || 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-1 group/switcher text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1 max-w-[160px] text-left outline-none cursor-pointer select-none"
          aria-label="Switch workspace"
        >
          <span className="truncate font-medium">
            {activeWorkspace?.name ?? 'Select workspace'}
          </span>
          <ChevronsUpDown className="w-3 h-3 shrink-0 text-text-tertiary group-hover/switcher:text-muted-foreground transition-colors duration-[--duration-instant]" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-56 bg-popover border border-border-subtle shadow-elevation-2 rounded-[--radius-lg] p-1"
        >
          <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-text-tertiary border-b border-border-subtle mb-1">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuGroup className="space-y-0.5">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id;

              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActive(ws)}
                  className={[
                    'flex items-center justify-between text-xs py-1.5 px-2.5 rounded-[--radius-sm] cursor-pointer transition-colors duration-[--duration-instant]',
                    isActive
                      ? 'bg-primary/12 border-l-2 border-primary text-foreground pl-[8px] font-medium' // matches active sidebar links
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-3'
                  ].join(' ')}
                >
                  <span className="truncate pr-2">{ws.name}</span>
                  {isActive && (
                    <span className="text-[9px] font-semibold bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded-[--radius-sm] tracking-wider uppercase scale-95 shrink-0">
                      Active
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="-mx-1 my-1 border-t border-border-subtle" />

          <DropdownMenuGroup className="space-y-0.5">
            <DropdownMenuItem
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 text-xs py-1.5 px-2.5 text-foreground hover:bg-surface-3 rounded-[--radius-sm] cursor-pointer transition-colors duration-[--duration-instant]"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Create Workspace</span>
            </DropdownMenuItem>

            {pendingInvitesCount > 0 && (
              <DropdownMenuItem
                onClick={() => navigate('/invites')}
                className="flex items-center justify-between text-xs py-1.5 px-2.5 text-warning bg-warning-muted/40 hover:bg-warning-muted/60 border border-warning/10 rounded-[--radius-sm] cursor-pointer transition-colors duration-[--duration-instant]"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pending Invites</span>
                </div>
                <span className="px-1.5 py-0.5 text-[9px] bg-warning text-background font-bold rounded-full font-mono scale-90">
                  {pendingInvitesCount}
                </span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-xs py-1.5 px-2.5 text-foreground hover:bg-surface-3 rounded-[--radius-sm] cursor-pointer transition-colors duration-[--duration-instant]"
            >
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Workspace Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
