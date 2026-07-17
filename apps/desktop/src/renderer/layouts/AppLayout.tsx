import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SyncWorker } from "../sync/sync-worker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useWorkspace } from "../hooks/useWorkspace";
import { Button } from "../components/ui/button";

import {
  SidebarInset,
  SidebarProvider,
} from "../components/ui/sidebar";
import AppHeader from "./AppHeader";
import { AppSidebar } from "../components/sidebar/AppSidebar";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});
type FormValues = z.infer<typeof schema>;

function CreateWorkspaceInlineForm() {
  const { createWorkspace } = useWorkspace();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await createWorkspace(values.name);
      toast.success("Workspace created successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
      <div className="space-y-1.5 text-left">
        <label htmlFor="inline-ws-name" className="text-xs font-medium text-foreground">
          Workspace name
        </label>
        <input
          id="inline-ws-name"
          type="text"
          placeholder="e.g. Acme Sales Team"
          {...register("name")}
          className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {errors.name && (
          <p className="text-[10px] text-danger-text">{errors.name.message}</p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full text-xs py-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create workspace"}
      </Button>
    </form>
  );
}

/**
 * AppLayout is the authenticated application shell.
 * It renders the sidebar, header, and the page content area via <Outlet />.
 * All auth and workspace state is read from their respective stores.
 */
export function AppLayout() {
  const { activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (workspaceId) {
      SyncWorker.start(queryClient, workspaceId);
    } else {
      SyncWorker.stop();
    }

    return () => {
      SyncWorker.stop();
    };
  }, [activeWorkspace?.id, queryClient]);

  if (!activeWorkspace) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
        <div className="w-full max-w-sm space-y-6 text-center border border-border-subtle p-8 rounded-xl bg-card">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Create a workspace
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              You need a workspace to start using LeadForge OS.
            </p>
          </div>
          <CreateWorkspaceInlineForm />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        <AppSidebar activeWorkspace={activeWorkspace} />

        <SidebarInset>
          <AppHeader />
          <div className="flex flex-col flex-1 min-w-0">
            {/* Page content */}
            <main className="flex-1 overflow-y-auto p-4">
              <Outlet />
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
