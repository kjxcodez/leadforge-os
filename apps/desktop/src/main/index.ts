import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { is } from '@electron-toolkit/utils';
import { SdkClient } from '@leadforge/sdk';

// Main window reference
let mainWindow: BrowserWindow | null = null;

// Local config persistence
function getLocalConfigPath() {
  return join(app.getPath('userData'), 'config.json');
}

function getPersistedActiveWorkspace(): string | null {
  try {
    const configPath = getLocalConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data.activeWorkspaceId || null;
    }
  } catch (err) {
    console.error('Failed to read local workspace config:', err);
  }
  return null;
}

function persistActiveWorkspace(workspaceId: string | null) {
  try {
    const configPath = getLocalConfigPath();
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    config.activeWorkspaceId = workspaceId;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local workspace config:', err);
  }
}

// SDK client initialization
const customHeaders: Record<string, string> = {};
let activeToken: string | null = null;

const sdk = new SdkClient({
  baseUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
  headers: customHeaders,
  tokenResolver: () => activeToken,
});

// IPC handlers registry
export const ipcHandlers = new Map<string, (event: Electron.IpcMainEvent, ...args: unknown[]) => void>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      disableBlinkFeatures: 'Auxclick',
    },
    titleBarStyle: 'default',
    frame: true,
    trafficLightPosition: { x: 10, y: 10 },
  });

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });


}

import { companyFiltersSchema, createCompanyDtoSchema } from '@leadforge/schema';

// Typed IPC event handlers
ipcMain.handle('companies:list', async (_event, payload) => {
  const filters = companyFiltersSchema.parse(payload);
  console.log('Main Process: Fetching companies with filters:', filters);
  return sdk.companies.list(filters);
});

ipcMain.handle('companies:create', async (_event, payload) => {
  const dto = createCompanyDtoSchema.parse(payload);
  console.log('Main Process: Creating company with DTO:', dto);
  return sdk.companies.create(dto);
});

ipcMain.handle('system:status', async () => {
  return [
    { name: 'API Server', status: 'online' },
    { name: 'Database', status: 'connected' },
  ];
});

ipcMain.handle('ipc:test', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

ipcMain.handle('auth:login', async (_event, payload) => {
  console.log('Main Process: Logging in user:', payload.email);
  const res = await sdk.auth.login(payload);
  activeToken = res.token;
  
  const savedWorkspaceId = getPersistedActiveWorkspace();
  const workspaceId = savedWorkspaceId || res.user?.activeWorkspaceId;
  if (workspaceId) {
    customHeaders['x-workspace-id'] = workspaceId;
  }
  return res;
});

ipcMain.handle('auth:register', async (_event, payload) => {
  console.log('Main Process: Registering user:', payload.email);
  const res = await sdk.auth.register(payload);
  activeToken = res.token;
  if (res.user?.activeWorkspaceId) {
    customHeaders['x-workspace-id'] = res.user.activeWorkspaceId;
  }
  return res;
});

ipcMain.handle('auth:logout', async () => {
  console.log('Main Process: Logging out user');
  try {
    await sdk.auth.logout();
  } catch (err) {
    console.error('Logout error on server:', err);
  } finally {
    activeToken = null;
    delete customHeaders['x-workspace-id'];
  }
});

ipcMain.handle('auth:session', async () => {
  console.log('Main Process: Verifying active token session');
  if (!activeToken) {
    return null;
  }
  try {
    const res = await sdk.auth.session();
    const savedWorkspaceId = getPersistedActiveWorkspace();
    const workspaceId = savedWorkspaceId || res?.user?.activeWorkspaceId;
    if (workspaceId) {
      customHeaders['x-workspace-id'] = workspaceId;
    }
    return res;
  } catch (err) {
    console.warn('Session verification failed, clearing token:', err);
    activeToken = null;
    delete customHeaders['x-workspace-id'];
    return null;
  }
});

ipcMain.handle('workspaces:create', async (_event, payload) => {
  console.log('Main Process: Creating workspace:', payload.name);
  return sdk.workspaces.create(payload);
});

ipcMain.handle('workspaces:list', async () => {
  console.log('Main Process: Listing workspaces');
  return sdk.workspaces.list();
});

ipcMain.handle('workspaces:update', async (_event, payload) => {
  console.log('Main Process: Updating workspace:', payload.id);
  return sdk.workspaces.update(payload.id, payload.dto);
});

ipcMain.handle('workspaces:delete', async (_event, payload) => {
  console.log('Main Process: Deleting workspace:', payload);
  return sdk.workspaces.delete(payload);
});

ipcMain.handle('workspaces:get', async (_event, payload) => {
  console.log('Main Process: Getting workspace details:', payload);
  return sdk.workspaces.get(payload);
});

ipcMain.handle('workspaces:members:list', async (_event, payload) => {
  console.log('Main Process: Listing workspace members:', payload);
  return sdk.workspaces.listMembers(payload);
});

ipcMain.handle('workspaces:members:invite', async (_event, payload) => {
  console.log('Main Process: Inviting member:', payload.id);
  return sdk.workspaces.inviteMember(payload.id, payload.dto);
});

ipcMain.handle('workspaces:members:updateRole', async (_event, payload) => {
  console.log('Main Process: Updating member role:', payload.memberId);
  return sdk.workspaces.updateMemberRole(payload.id, payload.memberId, payload.role);
});

ipcMain.handle('workspaces:members:remove', async (_event, payload) => {
  console.log('Main Process: Removing member:', payload.memberId);
  return sdk.workspaces.removeMember(payload.id, payload.memberId);
});

ipcMain.handle('workspaces:members:leave', async (_event, payload) => {
  console.log('Main Process: Leaving workspace:', payload);
  return sdk.workspaces.leave(payload);
});

ipcMain.handle('workspaces:members:transferOwnership', async (_event, payload) => {
  console.log('Main Process: Transferring ownership:', payload.newOwnerId);
  return sdk.workspaces.transferOwnership(payload.id, payload.newOwnerId);
});

ipcMain.handle('workspaces:invites:list', async () => {
  console.log('Main Process: Listing pending user invites');
  return sdk.workspaces.listPendingInvites();
});

ipcMain.handle('workspaces:invites:accept', async (_event, payload) => {
  console.log('Main Process: Accepting invite:', payload);
  return sdk.workspaces.acceptInvite(payload);
});

ipcMain.handle('workspaces:invites:decline', async (_event, payload) => {
  console.log('Main Process: Declining invite:', payload);
  return sdk.workspaces.declineInvite(payload);
});

ipcMain.handle('electron:setActiveWorkspace', (_event, workspaceId) => {
  console.log('Main Process: Setting active workspace headers:', workspaceId);
  if (workspaceId) {
    customHeaders['x-workspace-id'] = workspaceId;
  } else {
    delete customHeaders['x-workspace-id'];
  }
  persistActiveWorkspace(workspaceId);
});

ipcMain.handle('electron:getActiveWorkspace', () => {
  return getPersistedActiveWorkspace();
});

ipcMain.handle('electron:version', () => {
  return app.getVersion();
});

ipcMain.handle('electron:platform', () => {
  return process.platform;
});

ipcMain.handle('electron:openUrl', async (_event, url: string) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('electron:notify', (_event, payload: { title: string; body: string }) => {
  // Native notifications are handled here in the main process
  // Notification API is available from Electron's built-in module
  const { Notification } = require('electron');
  if (Notification.isSupported()) {
    new Notification({ title: payload.title, body: payload.body }).show();
  }
});

// Export stubs for backwards compatibility
export function registerIpcHandler() {}


// App lifecycle
app.whenReady().then(() => {
  // Set as app user model ID (Windows)
  app.setAppUserModelId('com.leadforge.desktop');

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Optimize for OS
  if (process.platform === 'darwin') {
    // macOS specific menu setup can go here
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});