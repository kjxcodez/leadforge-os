// ---------------------------------------------------------------------------
// Electron Service
// ---------------------------------------------------------------------------

/**
 * ElectronService provides safe access to native OS capabilities through IPC.
 * The renderer process must NEVER import Electron directly — this service
 * acts as the boundary.
 */
export const ElectronService = {
  /**
   * Opens a URL in the system's default browser.
   */
  async openExternal(url: string): Promise<void> {
    await window.ipc.invoke('electron:openUrl', url);
  },

  /**
   * Returns the application version string from package.json.
   */
  async getVersion(): Promise<string> {
    try {
      const res = await window.ipc.invoke('electron:version', undefined);
      return res ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  },

  /**
   * Returns the current OS platform identifier.
   */
  async getPlatform(): Promise<string> {
    try {
      const res = await window.ipc.invoke('electron:platform', undefined);
      return res ?? 'unknown';
    } catch {
      return 'unknown';
    }
  },

  /**
   * Sends a native OS notification.
   */
  async notify(title: string, body: string): Promise<void> {
    await window.ipc.invoke('electron:notify', { title, body });
  },
};
