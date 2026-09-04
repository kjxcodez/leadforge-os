import { safeRegister } from './helper';
import { getDatabase } from '../database/connection';
import { DesktopAnalyticsRepository } from '../database/analytics-repository';
import { WorkspaceManager } from '../lib/workspace-manager';

export function registerAnalyticsIpc(): void {
  safeRegister('analytics:campaign:overview', async (_event, { workspaceId, campaignId, query }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    // Try SDK if connected
    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.getOverview) {
        return await sdk.analytics.campaigns.getOverview(campaignId, query);
      }
    } catch {
      // Fallback to local SQLite cache
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.getOverview(workspaceId, campaignId, query);
  });

  safeRegister('analytics:campaign:timeline', async (_event, { workspaceId, campaignId, query }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.getTimeline) {
        return await sdk.analytics.campaigns.getTimeline(campaignId, query);
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.getTimeline(workspaceId, campaignId, query);
  });

  safeRegister('analytics:campaign:steps', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.getSteps) {
        return await sdk.analytics.campaigns.getSteps(campaignId);
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.getSteps(workspaceId, campaignId);
  });

  safeRegister('analytics:campaign:mailboxes', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.getMailboxes) {
        return await sdk.analytics.campaigns.getMailboxes(campaignId);
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.getMailboxes(workspaceId, campaignId);
  });

  safeRegister('analytics:campaign:quality', async (_event, { workspaceId, campaignId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.getQuality) {
        return await sdk.analytics.campaigns.getQuality(campaignId);
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.getQuality(workspaceId, campaignId);
  });

  safeRegister('analytics:campaign:compare', async (_event, { workspaceId, campaignIds, query }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignIds || campaignIds.length === 0) throw new Error('campaignIds is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.compare) {
        return await sdk.analytics.campaigns.compare({ campaignIds, ...query });
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.compare(workspaceId, campaignIds, query);
  });

  safeRegister('analytics:campaign:export', async (_event, { workspaceId, campaignId, format, query }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!campaignId) throw new Error('campaignId is required.');

    try {
      const sdk = WorkspaceManager.getSdk();
      if (sdk?.analytics?.campaigns?.export) {
        return await sdk.analytics.campaigns.export(campaignId, { format, ...query });
      }
    } catch {
      // Fallback
    }

    const db = getDatabase(workspaceId);
    const repo = new DesktopAnalyticsRepository(db);
    return repo.export(workspaceId, campaignId, format, query);
  });
}
