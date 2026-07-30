import { SdkClient } from '@leadforge/sdk';
import { registerAuthIpc } from './auth';
import { registerWorkspaceIpc } from './workspace';
import { registerCrmIpc } from './crm';
import { registerElectronIpc } from './electron';
import { registerDatabaseIpc } from './database';
import { registerOutreachIpc } from './outreach';
import { registerAutomationIpc } from './automation';
import { registerSchedulerIpc } from './scheduler';
import { registerDashboardIpc } from './dashboard';
import { registerLinkedInIpc } from './linkedin';
import { registerCampaignsIpc } from './campaigns-ipc';
import { registerOnboardingIpc } from './onboarding-ipc';
import { registerObservabilityIpc } from './observability-ipc';
import { WorkspaceManager } from '../lib/workspace-manager';

/**
 * Orchestrates and registers all IPC channels exactly once, utilizing safeRegister
 * to prevent duplicate handler collisions during hot reload HMR.
 */
export function registerAllIpc(
  sdk: SdkClient,
  customHeaders: Record<string, string>,
  setToken: (token: string | null) => void,
  persistActiveWorkspace: (workspaceId: string | null) => void,
  getPersistedActiveWorkspace: () => string | null
) {
  // Bind SDK instance to WorkspaceManager for isolated sync runtimes
  WorkspaceManager.setSdk(sdk);

  const setWorkspaceHeader = (workspaceId: string | null) => {
    if (workspaceId) {
      customHeaders['x-workspace-id'] = workspaceId;
    } else {
      delete customHeaders['x-workspace-id'];
    }
  };

  // Register domain specific handlers
  registerDatabaseIpc();
  registerAuthIpc(sdk, setToken, setWorkspaceHeader, persistActiveWorkspace, getPersistedActiveWorkspace);
  registerWorkspaceIpc(sdk, setWorkspaceHeader, persistActiveWorkspace, getPersistedActiveWorkspace);
  registerCrmIpc();
  registerElectronIpc(setWorkspaceHeader, persistActiveWorkspace, getPersistedActiveWorkspace);
  registerOutreachIpc(sdk);
  registerAutomationIpc(sdk);
  registerSchedulerIpc();
  registerDashboardIpc();
  registerLinkedInIpc();
  registerCampaignsIpc();
  registerOnboardingIpc();
  registerObservabilityIpc();
}
