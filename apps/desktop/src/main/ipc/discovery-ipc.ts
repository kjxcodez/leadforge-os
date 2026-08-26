import { safeRegister } from './helper';
import { LocalCRMRepository } from '../database/repositories/local-crm';
import { getDatabase } from '../database/connection';

export function registerDiscoveryIpc() {
  safeRegister('discovery:run:create', async (_event, payload) => {
    const { workspaceId, name, query, country, state, city, maxResults = 20, provider = 'google_maps' } = payload;
    if (!workspaceId) throw new Error('workspaceId is required.');
    if (!query || !query.trim()) throw new Error('Query is required.');
    if (!country || !country.trim()) throw new Error('Country is required.');
    if (!state || !state.trim()) throw new Error('State / Region is required.');

    const runName = name && name.trim() ? name.trim() : `${query} in ${city || state || country || 'Global'}`.trim();
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : require('crypto').randomUUID();

    const record = {
      id,
      workspaceId,
      name: runName,
      query,
      country: country || null,
      state: state || null,
      city: city || null,
      provider,
      status: 'running',
      resultCount: 0,
      startedAt: new Date().toISOString(),
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save discovery run record (triggers local DB insert + sync queue item)
    await LocalCRMRepository.save('discovery_runs', record);

    // Submit scraper job to scheduler jobs table
    const db = getDatabase(workspaceId);
    const jobId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : require('crypto').randomUUID();

    db.prepare(
      `
      INSERT INTO jobs (id, workspaceId, type, status, priority, payload, progress, retryCount, maxRetries, idempotencyKey, createdAt, updatedAt)
      VALUES (?, ?, 'scraper:maps', 'queued', 1, ?, 0, 0, 3, NULL, datetime('now'), datetime('now'))
    `
    ).run(
      jobId,
      workspaceId,
      JSON.stringify({
        discoveryRunId: id,
        query,
        country,
        state,
        city,
        maxResults
      })
    );

    return record;
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
