import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { validateLinkedInCookie } from '../workers/plugins/linkedin';

/**
 * Registers IPC handlers for LinkedIn integration settings and validation.
 */
export function registerLinkedInIpc() {
  safeRegister('linkedin:get-cookie-status', async (_event, { workspaceId }: { workspaceId: string }) => {
    if (!workspaceId) throw new Error('workspaceId is required');
    const db = getDatabase(workspaceId);
    const row = db.prepare('SELECT value FROM settings WHERE workspaceId = ? AND key = ?').get(workspaceId, 'linkedin_li_at') as { value: string } | undefined;

    if (!row || !row.value) {
      return { configured: false, preview: '' };
    }

    const val = row.value.trim();
    const preview = val.length > 8 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : '••••••••';
    return { configured: true, preview };
  });

  safeRegister('linkedin:save-cookie', async (_event, { workspaceId, cookie }: { workspaceId: string; cookie: string }) => {
    if (!workspaceId) throw new Error('workspaceId is required');
    const db = getDatabase(workspaceId);
    const cleanCookie = cookie.trim().replace(/^li_at=/i, '');

    db.prepare(`
      INSERT INTO settings (key, value, workspaceId, updatedAt)
      VALUES ('linkedin_li_at', ?, ?, datetime('now'))
      ON CONFLICT(key, workspaceId) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')
    `).run(cleanCookie, workspaceId);

    return { success: true };
  });

  safeRegister('linkedin:validate', async (_event, { cookie }: { cookie?: string }) => {
    if (!cookie) {
      return { valid: false, message: 'No cookie provided' };
    }
    return validateLinkedInCookie(cookie);
  });
}
