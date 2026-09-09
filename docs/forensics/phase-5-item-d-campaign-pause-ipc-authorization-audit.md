# LeadForge OS — Phase 5 Forensic Audit Report
## Item D: Forensic Audit of `campaigns:pause` IPC Authorization Failure

- **Issue Reference**: [#27](https://github.com/kjxcodez/leadforge-os/issues/27)
- **Investigation Date**: 2026-09-09
- **Classification**: Forensic Engineering Audit (Phase 5)
- **Severity**: **CRITICAL (P0)** — Broken Operational Killswitch

---

## 1. Executive Summary

During production operations, when an operator attempts to halt or pause an outbound email campaign via the desktop UI ("Pause Campaign" action in `CampaignsScreen.tsx`), the application fails with an unhandled runtime error:

```text
Unauthorized IPC channel: campaigns:pause
```

This audit traced the complete call chain from the React UI trigger through the Electron Preload context bridge and Main Process IPC registration to the background worker execution loop.

The investigation confirmed that while the main process implementation (`apps/desktop/src/main/ipc/campaigns-ipc.ts`) possesses a complete, robust handler for pausing campaigns, pausing SQLite sequence executions, and cancelling in-flight workflow jobs, the channel `campaigns:pause` (along with adjacent lifecycle channels `campaigns:resume`, `campaigns:stop`, and `campaigns:runtime:overview`) was omitted from the Electron Preload whitelist in `apps/desktop/src/preload/index.ts`.

Because Electron's security model enforces strict channel whitelisting in `window.ipc.invoke()`, the renderer request is rejected at the preload boundary before reaching the main process. As a direct consequence, **active outreach workflows cannot be paused from the UI**, allowing cold email dispatch to continue unchecked even when recipient complaints, provider rate limits, or domain blocks occur.

---

## 2. Repository Inspection & Runtime Code-Path Tracing

### 2.1 The UI Invocation Layer
**File:** [apps/desktop/src/renderer/screens/CampaignsScreen.tsx](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/renderer/screens/CampaignsScreen.tsx#L395-L440)

When an operator clicks the "Pause" button on a running campaign, the React component triggers `pauseCampaignMutation`:

```typescript
// Lines 395–409:
const pauseCampaignMutation = useMutation({
  mutationFn: async (campaignId: string) => {
    return window.ipc.invoke('campaigns:pause', campaignId);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    queryClient.invalidateQueries({
      queryKey: ['campaign_enrollments', workspaceId, selectedCampaignId]
    });
    toast.success('Campaign paused.');
  },
  onError: (err: any) => {
    toast.error(`Failed to pause campaign: ${err.message || err}`);
  }
});
```

Adjacent UI mutations similarly invoke:
- `resumeCampaignMutation`: `window.ipc.invoke('campaigns:resume', campaignId)` (lines 411–425)
- `stopCampaignMutation`: `window.ipc.invoke('campaigns:stop', campaignId)` (lines 427–440)

### 2.2 The Preload Security Boundary (Defect Root Cause)
**File:** [apps/desktop/src/preload/index.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/preload/index.ts#L70-L217)

The Electron context bridge exposes `window.ipc.invoke` with an explicit channel whitelist to protect against unauthorized renderer access:

```typescript
// Lines 213–216:
if (validChannels.includes(channel as string)) {
  return ipcRenderer.invoke(channel, payload);
}
throw new Error(`Unauthorized IPC channel: ${channel}`);
```

Inspection of `validChannels` reveals the following campaign-related entries:
```typescript
// Lines 78–82:
'campaigns:list',
'campaigns:get',
'campaigns:create',
'campaigns:update',
'campaigns:delete',

// Line 121:
'campaigns:schedule',

// Lines 180–184 (added in prior Issue #19):
'campaigns:enroll',
'campaigns:enrollments:list',
'campaigns:bulk-pause-enrollments',
'campaigns:bulk-resume-enrollments',
'campaigns:bulk-remove-enrollments',
```

**Missing Channels:**
- `campaigns:pause` — **MISSING**
- `campaigns:resume` — **MISSING**
- `campaigns:stop` — **MISSING**
- `campaigns:runtime:overview` — **MISSING**

When `window.ipc.invoke('campaigns:pause', campaignId)` is called, `validChannels.includes('campaigns:pause')` evaluates to `false`, throwing the `Unauthorized IPC channel: campaigns:pause` error into `onError` and rendering an error toast.

### 2.3 The Main Process Registration (Fully Implemented)
**File:** [apps/desktop/src/main/ipc/campaigns-ipc.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/ipc/campaigns-ipc.ts#L440-L490)

The main process correctly registers the channel via `safeRegister`:

```typescript
// Lines 441–490:
safeRegister('campaigns:pause', async (_event, campaignId) => {
  if (!campaignId) throw new Error('campaignId is required.');
  const runtime = WorkspaceManager.getActiveRuntime();
  if (!runtime) throw new Error('No active workspace runtime');

  const db = getDatabase(runtime.workspaceId);
  const sdk = WorkspaceManager.getSdk();
  const now = new Date().toISOString();

  // 1. Authoritative server update with USER_REQUESTED pauseReason
  const updated = await sdk.campaigns.update(campaignId, {
    status: 'PAUSED' as any,
    settings: { pauseReason: 'USER_REQUESTED' } as any
  });
  if (updated) await LocalCRMRepository.saveFromServer('campaigns', updated);

  // 2. Pause active and waiting sequence executions in SQLite
  db.prepare(`
    UPDATE sequence_executions
    SET status = 'PAUSED', updatedAt = ?
    WHERE campaignId = ? AND UPPER(status) IN ('RUNNING', 'QUEUED', 'STARTING', 'WAITING')
  `).run(now, campaignId);

  // 3. Cancel any in-flight/queued jobs for this campaign
  const jobsList = await sdk.jobs.list({ limit: 100 });
  const jobsToCancel = (jobsList.data || []).filter(...);
  for (const job of jobsToCancel) {
    await sdk.jobs.cancel(job.id).catch(() => {});
  }

  return { success: true, campaignId, status: 'PAUSED' };
});
```

The handler is complete, fully wired to cancel background jobs, update SQLite execution states, and sync with MongoDB. The only obstacle preventing execution is the preload whitelist filter.

### 2.4 Downstream Impact on the Deterministic Outreach Engine
**File:** [apps/desktop/src/main/workers/plugins/automation.ts](file:///c:/Users/91637/Desktop/Business%20Project/leadforge-os/apps/desktop/src/main/workers/plugins/automation.ts#L1721-L1748)

The worker plugin contains send-time server-authoritative campaign authorization checks:

```typescript
// Lines 1739–1748:
if (campStatus === 'PAUSED') {
  ctx.emitLog(`Campaign "${campaignId}" is PAUSED. Halting email send step and setting execution PAUSED.`, 'info');
  try {
    if (execCtx.execution.id) {
      await sdk.executions.update(execCtx.execution.id, { status: 'PAUSED' });
    }
    await sdk.locks.releaseLock(sequenceId, entityId);
  } catch {}
  return { status: 'paused' };
}
```

Because `campaigns:pause` is rejected before it can reach the main process, `campaignDoc.status` remains `ACTIVE`. The background worker continues sending outbound emails unimpeded.

---

## 3. Reproduction & Evidence

### 3.1 Defect Reproduction Matrix
| Component | Channel | Expected Outcome | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| `CampaignsScreen.tsx` | `campaigns:pause` | Campaign paused, executions set to `PAUSED` | `Error: Unauthorized IPC channel: campaigns:pause` | **CONFIRMED** |
| `CampaignsScreen.tsx` | `campaigns:resume` | Campaign resumed, executions re-queued | `Error: Unauthorized IPC channel: campaigns:resume` | **CONFIRMED** |
| `CampaignsScreen.tsx` | `campaigns:stop` | Campaign stopped permanently | `Error: Unauthorized IPC channel: campaigns:stop` | **CONFIRMED** |
| `CampaignsScreen.tsx` | `campaigns:runtime:overview` | Runtime metrics returned | `Error: Unauthorized IPC channel: campaigns:runtime:overview` | **CONFIRMED** |

### 3.2 Historical Root Cause
In previous sprint Issue [#19](https://github.com/kjxcodez/leadforge-os/issues/19) (`bug(desktop): campaigns:enroll and campaigns:enrollments IPC channels unauthorized`), an identical issue was fixed by adding `campaigns:enroll` and `campaigns:enrollments:list` to `apps/desktop/src/preload/index.ts`. However, the author of that fix failed to audit the entire `campaigns-ipc.ts` registration table, inadvertently leaving `campaigns:pause`, `campaigns:resume`, and `campaigns:stop` unauthorized.

---

## 4. Categorization of Audit Findings

1. **`[CONFIRMED]` Preload Whitelist Rejection:**
   `campaigns:pause`, `campaigns:resume`, `campaigns:stop`, and `campaigns:runtime:overview` are not present in `apps/desktop/src/preload/index.ts` `validChannels`, causing immediate runtime rejection with `Unauthorized IPC channel`.

2. **`[CONFIRMED]` Complete Main Process Handler:**
   `apps/desktop/src/main/ipc/campaigns-ipc.ts` already contains the full atomic implementation to pause the campaign in MongoDB, update local SQLite `campaigns` and `sequence_executions` tables, and cancel in-flight worker jobs.

3. **`[CONFIRMED]` Worker Safety Gate Dependence:**
   `apps/desktop/src/main/workers/plugins/automation.ts` relies on `campStatus === 'PAUSED'` to abort sends. Because the IPC channel is blocked, this safety gate is completely bypassed, resulting in uncontrolled outbound sending.

4. **`[STRONGLY INDICATED]` Compounding Production Risk with Items A, B, and C:**
   When outbound emails are rejected by providers (Item A), or when multiple contacts at the same company are messaged (Item B), or when a DNC request is received (Item C), an operator's immediate recourse is to pause the campaign. The broken pause channel prevents mitigation of all three failure modes.

---

## 5. Recommended Implementation Boundary

To remediate this issue cleanly without architectural deviation:

1. **Preload Channel Whitelist Update:**
   Add the following channels to `validChannels` in `apps/desktop/src/preload/index.ts`:
   - `'campaigns:pause'`
   - `'campaigns:resume'`
   - `'campaigns:stop'`
   - `'campaigns:runtime:overview'`

2. **TypeScript Contract Whitelist:**
   Ensure `IpcChannelMap` in `packages/schema/src/ipc/` (or local preload declarations) includes the channel type signatures for `campaigns:pause`, `campaigns:resume`, and `campaigns:stop` if not already present.

3. **Verification Suite:**
   Include a regression test asserting that all registered channels in `apps/desktop/src/main/ipc/campaigns-ipc.ts` exist in the preload whitelist in `apps/desktop/src/preload/index.ts`.
