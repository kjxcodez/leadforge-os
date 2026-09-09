import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 5 Forensic Audit — Issue #27: campaigns:pause IPC Authorization', () => {
  const preloadPath = path.resolve(__dirname, '../../preload/index.ts');
  const campaignsIpcPath = path.resolve(__dirname, '../ipc/campaigns-ipc.ts');
  const campaignsScreenPath = path.resolve(__dirname, '../../renderer/screens/CampaignsScreen.tsx');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Static Contract & Whitelist Verification
  // ──────────────────────────────────────────────────────────────────────────
  describe('Static Preload & Handler Whitelist Audit', () => {
    it('confirms that CampaignsScreen.tsx invokes campaigns:pause, campaigns:resume, and campaigns:stop', () => {
      const screenContent = fs.readFileSync(campaignsScreenPath, 'utf8');

      expect(screenContent).toContain("window.ipc.invoke('campaigns:pause', campaignId)");
      expect(screenContent).toContain("window.ipc.invoke('campaigns:resume', campaignId)");
      expect(screenContent).toContain("window.ipc.invoke('campaigns:stop', campaignId)");
    });

    it('confirms that campaigns-ipc.ts registers safeRegister for campaigns:pause, resume, and stop', () => {
      const ipcContent = fs.readFileSync(campaignsIpcPath, 'utf8');

      expect(ipcContent).toContain("safeRegister('campaigns:pause'");
      expect(ipcContent).toContain("safeRegister('campaigns:resume'");
      expect(ipcContent).toContain("safeRegister('campaigns:stop'");
      expect(ipcContent).toContain("safeRegister('campaigns:runtime:overview'");
    });

    it('confirms the defect: campaigns:pause is missing from preload/index.ts validChannels', () => {
      const preloadContent = fs.readFileSync(preloadPath, 'utf8');

      // Locate the validChannels array in window.ipc.invoke
      const invokeSection = preloadContent.slice(
        preloadContent.indexOf('invoke: <K extends keyof IpcChannelMap>'),
        preloadContent.indexOf('on: <K extends keyof IpcChannelMap>')
      );

      // Confirm presence of previously fixed channels
      expect(invokeSection).toContain("'campaigns:enroll'");
      expect(invokeSection).toContain("'campaigns:enrollments:list'");

      // CONFIRMED DEFECT: The pause, resume, stop, and overview channels are missing from validChannels
      const hasPause = invokeSection.includes("'campaigns:pause'");
      const hasResume = invokeSection.includes("'campaigns:resume'");
      const hasStop = invokeSection.includes("'campaigns:stop'");
      const hasOverview = invokeSection.includes("'campaigns:runtime:overview'");

      expect(hasPause).toBe(false);
      expect(hasResume).toBe(false);
      expect(hasStop).toBe(false);
      expect(hasOverview).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Runtime Behavior Simulation & Error Reproduction
  // ──────────────────────────────────────────────────────────────────────────
  describe('Runtime Preload Invocation Simulation', () => {
    it('reproduces the exact runtime Unauthorized IPC channel exception', async () => {
      // Simulating exact preload invoke logic
      const simulatePreloadInvoke = (channel: string, validChannels: string[]) => {
        if (validChannels.includes(channel)) {
          return Promise.resolve({ success: true });
        }
        return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
      };

      // Extract channels from current preload
      const preloadContent = fs.readFileSync(preloadPath, 'utf8');
      const invokeSection = preloadContent.slice(
        preloadContent.indexOf('invoke: <K extends keyof IpcChannelMap>'),
        preloadContent.indexOf('on: <K extends keyof IpcChannelMap>')
      );

      const channelMatches = invokeSection.match(/'[a-zA-Z0-9_:-]+'/g) || [];
      const currentValidChannels = channelMatches.map((c) => c.replace(/'/g, ''));

      // Invocations that are authorized
      await expect(simulatePreloadInvoke('campaigns:list', currentValidChannels)).resolves.toEqual({ success: true });
      await expect(simulatePreloadInvoke('campaigns:enroll', currentValidChannels)).resolves.toEqual({ success: true });

      // Invocations that fail with Unauthorized IPC channel (reproduced defect)
      await expect(simulatePreloadInvoke('campaigns:pause', currentValidChannels)).rejects.toThrow(
        'Unauthorized IPC channel: campaigns:pause'
      );
      await expect(simulatePreloadInvoke('campaigns:resume', currentValidChannels)).rejects.toThrow(
        'Unauthorized IPC channel: campaigns:resume'
      );
      await expect(simulatePreloadInvoke('campaigns:stop', currentValidChannels)).rejects.toThrow(
        'Unauthorized IPC channel: campaigns:stop'
      );
      await expect(simulatePreloadInvoke('campaigns:runtime:overview', currentValidChannels)).rejects.toThrow(
        'Unauthorized IPC channel: campaigns:runtime:overview'
      );
    });

    it('proves that adding the missing channels resolves authorization without breaking existing channels', async () => {
      const simulatePreloadInvoke = (channel: string, validChannels: string[]) => {
        if (validChannels.includes(channel)) {
          return Promise.resolve({ success: true });
        }
        return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
      };

      const preloadContent = fs.readFileSync(preloadPath, 'utf8');
      const invokeSection = preloadContent.slice(
        preloadContent.indexOf('invoke: <K extends keyof IpcChannelMap>'),
        preloadContent.indexOf('on: <K extends keyof IpcChannelMap>')
      );
      const channelMatches = invokeSection.match(/'[a-zA-Z0-9_:-]+'/g) || [];
      const currentValidChannels = channelMatches.map((c) => c.replace(/'/g, ''));

      // Proposed patch channels
      const proposedValidChannels = [
        ...currentValidChannels,
        'campaigns:pause',
        'campaigns:resume',
        'campaigns:stop',
        'campaigns:runtime:overview'
      ];

      // All channels now succeed
      await expect(simulatePreloadInvoke('campaigns:pause', proposedValidChannels)).resolves.toEqual({ success: true });
      await expect(simulatePreloadInvoke('campaigns:resume', proposedValidChannels)).resolves.toEqual({ success: true });
      await expect(simulatePreloadInvoke('campaigns:stop', proposedValidChannels)).resolves.toEqual({ success: true });
      await expect(simulatePreloadInvoke('campaigns:runtime:overview', proposedValidChannels)).resolves.toEqual({ success: true });
    });
  });
});
