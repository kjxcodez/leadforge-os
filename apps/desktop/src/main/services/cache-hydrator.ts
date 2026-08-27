import { SdkClient } from '@leadforge/sdk';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { AppLogger } from '../lib/logger';
import { BrowserWindow } from 'electron';

/**
 * CacheHydrator pulls canonical business data from the remote MongoDB server (via SdkClient)
 * and populates or refreshes the local SQLite materialized read cache for a workspace.
 */
export class CacheHydrator {
  /**
   * Hydrates all durable business entities for a workspace from MongoDB into SQLite.
   */
  public static async hydrateWorkspaceCache(workspaceId: string, sdk: SdkClient): Promise<void> {
    AppLogger.info('CacheHydrator', `Starting workspace cache hydration for ${workspaceId}`, workspaceId);

    const entities: Array<{
      table: string;
      fetch: () => Promise<any[]>;
      transform?: (item: any) => any;
    }> = [
      {
        table: 'companies',
        fetch: () => sdk.companies.list()
      },
      {
        table: 'contacts',
        fetch: () => sdk.contacts.list()
      },
      {
        table: 'campaigns',
        fetch: () => sdk.campaigns.list(),
        transform: (c) => ({
          ...c,
          status: c.status ? c.status.toUpperCase() : 'DRAFT'
        })
      },
      {
        table: 'sequences',
        fetch: () => sdk.sequences.list()
      },
      {
        table: 'sequence_executions',
        fetch: () => sdk.executions.list(),
        transform: (ex) => ({
          ...ex,
          status: ex.status ? ex.status.toUpperCase() : 'PENDING'
        })
      },
      {
        table: 'email_accounts',
        fetch: () => sdk.outreach.listAccounts()
      },
      {
        table: 'templates',
        fetch: () => sdk.outreach.listTemplates(),
        transform: (t) => ({
          ...t,
          variables: typeof t.variables === 'string' ? t.variables : JSON.stringify(t.variables || []),
          attachments: typeof t.attachments === 'string' ? t.attachments : JSON.stringify(t.attachments || [])
        })
      },
      {
        table: 'discovery_runs',
        fetch: () => sdk.discovery.listRuns()
      },
      {
        table: 'audiences',
        fetch: () => sdk.audiences.list()
      }
    ];

    for (const { table, fetch, transform } of entities) {
      try {
        const list = await fetch();
        if (Array.isArray(list) && list.length > 0) {
          const records = list.map((item: any) => {
            const base = transform ? transform(item) : item;
            return {
              ...base,
              workspaceId,
              syncStatus: 'synced'
            };
          });
          await LocalCRMRepository.saveMany(table, records, true);
        }
      } catch (err) {
        AppLogger.warn('CacheHydrator', `Failed to hydrate cache table "${table}": ${err}`, workspaceId);
      }
    }

    AppLogger.info('CacheHydrator', `Completed workspace cache hydration for ${workspaceId}`, workspaceId);
    this.broadcastCacheUpdated();
  }

  /**
   * Hydrates a single entity table on-demand from MongoDB into SQLite.
   */
  public static async hydrateEntityTable(table: string, workspaceId: string, sdk: SdkClient): Promise<any[]> {
    try {
      let list: any[] = [];
      if (table === 'companies') list = await sdk.companies.list();
      else if (table === 'contacts') list = await sdk.contacts.list();
      else if (table === 'campaigns') list = await sdk.campaigns.list();
      else if (table === 'sequences') list = await sdk.sequences.list();
      else if (table === 'templates') list = await sdk.outreach.listTemplates();
      else if (table === 'email_accounts') list = await sdk.outreach.listAccounts();
      else if (table === 'audiences') list = await sdk.audiences.list();
      else if (table === 'discovery_runs') list = await sdk.discovery.listRuns();

      if (Array.isArray(list) && list.length > 0) {
        const records = list.map((item: any) => ({
          ...item,
          workspaceId,
          syncStatus: 'synced',
          variables: typeof item.variables === 'string' ? item.variables : JSON.stringify(item.variables || []),
          attachments: typeof item.attachments === 'string' ? item.attachments : JSON.stringify(item.attachments || [])
        }));
        await LocalCRMRepository.saveMany(table, records, true);
      }
      return list;
    } catch (err) {
      AppLogger.warn('CacheHydrator', `Single table hydration failed for "${table}": ${err}`, workspaceId);
      return LocalCRMRepository.findMany(table, workspaceId);
    }
  }

  /**
   * Broadcasts a cache-updated event to all active renderer windows.
   */
  private static broadcastCacheUpdated(): void {
    try {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('sync:completed', { timestamp: new Date().toISOString() });
        }
      });
    } catch {
      // IPC window context not yet active
    }
  }
}
