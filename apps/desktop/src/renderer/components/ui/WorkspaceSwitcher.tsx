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
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5 max-w-[140px] text-left outline-none cursor-default"
          aria-label="Switch workspace"
        >
          <span className="truncate font-medium">{activeWorkspace?.name ?? 'Select workspace'}</span>
          <ChevronsUpDown className="w-2.5 h-2.5 shrink-0 opacity-60" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="w-52">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuGroup>
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id;
              
              return (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => setActive(ws)}
                  className={`flex items-center justify-between text-xs py-1.5 ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'}`}
                >
                  <span className="truncate">{ws.name}</span>
                  {isActive && <span className="text-[10px] bg-accent/25 px-1 rounded text-accent font-bold">Active</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 text-xs py-1.5 text-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Workspace</span>
          </DropdownMenuItem>

          {pendingInvitesCount > 0 && (
            <DropdownMenuItem
              onClick={() => navigate('/invites')}
              className="flex items-center justify-between text-xs py-1.5 text-warning-text bg-warning-bg/10 hover:bg-warning-bg/25"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pending Invites</span>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] bg-warning-text text-white font-bold rounded-full">
                {pendingInvitesCount}
              </span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 text-xs py-1.5 text-foreground"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Workspace Settings</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
