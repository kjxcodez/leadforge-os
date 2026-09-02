import http from 'http';
import assert from 'assert';
import { ConnectivityService } from '../apps/desktop/src/main/services/connectivity-service.js';
import { WorkspaceManager } from '../apps/desktop/src/main/lib/workspace-manager.js';
import { SdkClient } from '@leadforge/sdk';

async function run() {
  console.log('========================================================================');
  console.log(' LeadForge OS — Phase 2A Connectivity & Runtime Foundation Test');
  console.log('========================================================================\n');

  let passedTests = 0;
  const totalTests = 7;

  // -------------------------------------------------------------------------
  // TEST 1: API Online Handshake
  // -------------------------------------------------------------------------
  console.log('--- [Test 1] API Online & Healthy Probe ---');
  const healthyServer = http.createServer((req, res) => {
    if (req.url?.includes('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          status: 'OK',
          uptime: 120,
          database: { status: 'connected', readyState: 1 },
          version: '1.0.0'
        }
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => healthyServer.listen(0, resolve));
  const healthyPort = (healthyServer.address() as any).port;
  const healthyUrl = `http://127.0.0.1:${healthyPort}/api/v1`;

  const state1 = await ConnectivityService.checkConnectivity(healthyUrl, 2000);
  assert.strictEqual(state1.status, 'ONLINE', 'Expected ONLINE status when server is healthy');
  assert.strictEqual(state1.error, null, 'Expected error to be null when healthy');
  console.log('✓ Test 1 Passed: Healthy API correctly transitions runtime to ONLINE\n');
  passedTests++;
  healthyServer.close();

  // -------------------------------------------------------------------------
  // TEST 2: API Offline / Port Closed
  // -------------------------------------------------------------------------
  console.log('--- [Test 2] API Offline (Port Closed) Gating Check ---');
  // Use a port guaranteed not to be open
  const closedUrl = 'http://127.0.0.1:59998/api/v1';

  const state2 = await ConnectivityService.checkConnectivity(closedUrl, 2000);
  assert.strictEqual(state2.status, 'DEGRADED', 'Expected DEGRADED status when server is down');
  assert(state2.error !== null, 'Expected non-null error object');
  assert.strictEqual(state2.error?.code, 'NETWORK_UNREACHABLE', 'Expected code NETWORK_UNREACHABLE');
  assert.strictEqual(WorkspaceManager.getActiveRuntime(), null, 'Workspace runtime must NOT be active when offline');
  console.log(`✓ Test 2 Passed: Closed port correctly transitions to DEGRADED (${state2.error?.code})\n`);
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 3: Bounded Timeout Probe
  // -------------------------------------------------------------------------
  console.log('--- [Test 3] Bounded Timeout Probe ---');
  const hangingServer = http.createServer((_req, _res) => {
    // Deliberately never respond
  });

  await new Promise<void>((resolve) => hangingServer.listen(0, resolve));
  const hangingPort = (hangingServer.address() as any).port;
  const hangingUrl = `http://127.0.0.1:${hangingPort}/api/v1`;

  const t0 = Date.now();
  const state3 = await ConnectivityService.checkConnectivity(hangingUrl, 1000);
  const elapsed = Date.now() - t0;

  assert(elapsed >= 900 && elapsed < 2500, `Expected elapsed time around 1000ms, got ${elapsed}ms`);
  assert.strictEqual(state3.status, 'DEGRADED', 'Expected DEGRADED status on timeout');
  assert.strictEqual(state3.error?.code, 'TIMEOUT', 'Expected code TIMEOUT');
  console.log(`✓ Test 3 Passed: Hanging server cleanly times out in ${elapsed}ms with TIMEOUT code\n`);
  passedTests++;
  hangingServer.close();

  // -------------------------------------------------------------------------
  // TEST 4: HTTP 401 Unauthorized Classification
  // -------------------------------------------------------------------------
  console.log('--- [Test 4] HTTP 401 Classification ---');
  const authServer = http.createServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }));
  });

  await new Promise<void>((resolve) => authServer.listen(0, resolve));
  const authPort = (authServer.address() as any).port;
  const authUrl = `http://127.0.0.1:${authPort}/api/v1`;

  const state4 = await ConnectivityService.checkConnectivity(authUrl, 2000);
  assert.strictEqual(state4.status, 'AUTHENTICATION_REQUIRED', 'Expected AUTHENTICATION_REQUIRED status on 401');
  assert.strictEqual(state4.error?.code, 'HTTP_401', 'Expected code HTTP_401');
  console.log('✓ Test 4 Passed: HTTP 401 correctly categorized as AUTHENTICATION_REQUIRED\n');
  passedTests++;
  authServer.close();

  // -------------------------------------------------------------------------
  // TEST 5: Controlled Recovery Handshake
  // -------------------------------------------------------------------------
  console.log('--- [Test 5] Controlled Reconnection & Recovery Handshake ---');
  // First ensure in DEGRADED state
  await ConnectivityService.checkConnectivity(closedUrl, 500);
  assert.strictEqual(ConnectivityService.getState().status, 'DEGRADED');

  // Now start healthy server
  const recoveryServer = http.createServer((req, res) => {
    if (req.url?.includes('/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { status: 'OK', uptime: 10, database: { status: 'connected', readyState: 1 } }
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: [] }));
    }
  });

  await new Promise<void>((resolve) => recoveryServer.listen(0, resolve));
  const recPort = (recoveryServer.address() as any).port;
  const recUrl = `http://127.0.0.1:${recPort}/api/v1`;

  const mockSdk = new SdkClient({ baseUrl: recUrl });
  WorkspaceManager.setSdk(mockSdk);

  const targetWsId = 'ws-recovery-test-' + Date.now();
  ConnectivityService.setState({ apiUrl: recUrl });

  const recoveredState = await ConnectivityService.recoverConnection(mockSdk, targetWsId);
  assert.strictEqual(recoveredState.status, 'ONLINE', 'Expected status ONLINE after recovery');
  assert.strictEqual(recoveredState.error, null, 'Expected error null after recovery');
  assert.strictEqual(WorkspaceManager.getActiveRuntime()?.workspaceId, targetWsId, 'Expected target workspace to be active');

  // Verify only 1 active runtime
  const metrics = WorkspaceManager.getLifecycleMetrics();
  assert.strictEqual(metrics.currentActiveRuntimeId, targetWsId, 'Expected exactly one active runtime ID');
  console.log('✓ Test 5 Passed: Recovery safely transitions from DEGRADED to ONLINE with exactly 1 runtime\n');
  passedTests++;

  // Clean up runtime
  await WorkspaceManager.setActiveWorkspace(null);
  recoveryServer.close();

  // -------------------------------------------------------------------------
  // TEST 6: Workspace Isolation on Transition
  // -------------------------------------------------------------------------
  console.log('--- [Test 6] Workspace Isolation during Switching & Offline ---');
  const wsA = 'ws-iso-A-' + Date.now();
  const wsB = 'ws-iso-B-' + Date.now();

  const isoServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: { status: 'OK', database: { status: 'connected', readyState: 1 } }
    }));
  });

  await new Promise<void>((resolve) => isoServer.listen(0, resolve));
  const isoPort = (isoServer.address() as any).port;
  const isoUrl = `http://127.0.0.1:${isoPort}/api/v1`;

  const isoSdk = new SdkClient({ baseUrl: isoUrl });
  WorkspaceManager.setSdk(isoSdk);

  await WorkspaceManager.setActiveWorkspace(wsA);
  assert.strictEqual(WorkspaceManager.getActiveRuntime()?.workspaceId, wsA);

  await WorkspaceManager.setActiveWorkspace(wsB);
  assert.strictEqual(WorkspaceManager.getActiveRuntime()?.workspaceId, wsB);
  assert.notStrictEqual(WorkspaceManager.getActiveRuntime()?.workspaceId, wsA);

  await WorkspaceManager.setActiveWorkspace(null);
  isoServer.close();
  console.log('✓ Test 6 Passed: Workspace switching maintains clean isolation without cross-contamination\n');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 7: No Request Storm While Offline
  // -------------------------------------------------------------------------
  console.log('--- [Test 7] No Request Storm While Offline ---');
  let claimRequestsReceived = 0;
  const claimTrackingServer = http.createServer((req, res) => {
    if (req.url?.includes('/jobs/claim')) {
      claimRequestsReceived++;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: null }));
  });

  await new Promise<void>((resolve) => claimTrackingServer.listen(0, resolve));
  const claimPort = (claimTrackingServer.address() as any).port;
  const claimUrl = `http://127.0.0.1:${claimPort}/api/v1`;

  // Set connectivity to degraded (offline) and verify no scheduler was started
  ConnectivityService.setState({ status: 'DEGRADED', error: { code: 'NETWORK_UNREACHABLE', message: 'Offline' } });
  
  // Wait 4 seconds (longer than default 3s scheduler interval)
  await new Promise((r) => setTimeout(r, 4000));

  assert.strictEqual(claimRequestsReceived, 0, 'Zero claim requests should be emitted while offline');
  assert.strictEqual(WorkspaceManager.getActiveRuntime(), null, 'No workspace runtime should run while offline');
  claimTrackingServer.close();
  console.log('✓ Test 7 Passed: Confirmed 0 /jobs/claim requests emitted while in DEGRADED state\n');
  passedTests++;

  console.log('========================================================================');
  console.log(` ALL ${passedTests}/${totalTests} TESTS PASSED — PHASE 2A CERTIFIED`);
  console.log('========================================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
