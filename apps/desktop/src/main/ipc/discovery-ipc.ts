import { safeRegister } from './helper';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { getDatabase } from '../database/connection';
import { WorkspaceManager } from '../lib/workspace-manager';

export function registerDiscoveryIpc() {
  safeRegister('discovery:run:create', async (_event, payload) => {
    const { workspaceId, name, query, country, state, city, maxResults = 20, provider = 'google_maps' } = payload;
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!query || !query.trim()) throw new Error('Query is required.');
    if (!country || !country.trim()) throw new Error('Country is required.');
    if (!state || !state.trim()) throw new Error('State / Region is required.');

    const runName = name && name.trim() ? name.trim() : `${query} in ${city || state || country || 'Global'}`.trim();
    const sdk = WorkspaceManager.getSdk();

    const created = await sdk.discovery.createRun({
      workspaceId,
      name: runName,
      query,
      country: country || null,
      state: state || null,
      city: city || null,
      provider,
      status: 'running',
      resultCount: 0,
      startedAt: new Date().toISOString()
    });

    // Save discovery run record directly into SQLite cache
    await LocalCRMRepository.saveFromServer('discovery_runs', created);

    // Submit scraper job to scheduler via MongoDB SDK
    const jobId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : require('crypto').randomUUID();

    try {
      await sdk.jobs.create({
        id: jobId,
        type: 'scraper:maps',
        priority: 1,
        payload: {
          discoveryRunId: created.id,
          query,
          country,
          state,
          city,
          maxResults
        },
        maxRetries: 3
      });
    } catch (err) {
      console.warn('[IPC] Scraper job queueing note:', err);
    }

    return created;
  });

  safeRegister('discovery:run:list', async (_event, { workspaceId }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    return LocalCRMRepository.findMany('discovery_runs', workspaceId);
  });

  safeRegister('discovery:run:get', async (_event, { workspaceId, id }) => {
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!id) throw new Error('id is required.');
    return LocalCRMRepository.findById('discovery_runs', workspaceId, id);
  });
}
