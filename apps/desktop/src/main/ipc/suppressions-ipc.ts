import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { DesktopSuppressionRepository } from '../database/suppression-repository';
import { WorkspaceManager } from '../lib/workspace-manager';
import { SuppressionReason } from '@leadforge/schema';

export function registerSuppressionsIpc(): void {
  safeRegister('suppressions:list', async (_event, { workspaceId, limit, offset }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    const db = getDatabase(workspaceId);
    const repo = new DesktopSuppressionRepository(db);
    return repo.listSuppressions(workspaceId, limit, offset);
  });

  safeRegister('suppressions:check', async (_event, { workspaceId, email }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!email) throw new Error('email is required.');
    const db = getDatabase(workspaceId);
    const repo = new DesktopSuppressionRepository(db);
    const record = repo.getSuppression(workspaceId, email);
    return {
      email,
      suppressed: Boolean(record),
      suppression: record
    };
  });

  safeRegister('suppressions:suppress', async (_event, { workspaceId, email, reason, source, notes }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!email) throw new Error('email is required.');
    const db = getDatabase(workspaceId);
    const repo = new DesktopSuppressionRepository(db);
    repo.suppress(
      workspaceId,
      email,
      (reason as SuppressionReason) || SuppressionReason.MANUAL_SUPPRESSION,
      source || 'desktop_ui',
      null,
      null,
      notes || null
    );

    // Sync to API server if available
    try {
      const sdk = WorkspaceManager.getSdk();
      if ((sdk as any).suppressions?.create) {
        await (sdk as any).suppressions.create({ email, reason, source, notes });
      }
    } catch {}

    return { success: true, email };
  });

  safeRegister('suppressions:unsuppress', async (_event, { workspaceId, email }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!email) throw new Error('email is required.');
    const db = getDatabase(workspaceId);
    const repo = new DesktopSuppressionRepository(db);
    const unsuppressed = repo.unsuppress(workspaceId, email);

    // Sync to API server if available
    try {
      const sdk = WorkspaceManager.getSdk();
      if ((sdk as any).suppressions?.delete) {
        await (sdk as any).suppressions.delete(email);
      }
    } catch {}

    return { success: true, unsuppressed, email };
  });
}
