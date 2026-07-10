import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { SdkClient } from '@leadforge/sdk';

// Main window reference
let mainWindow: BrowserWindow | null = null;

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
  if (res.user?.activeWorkspaceId) {
    customHeaders['x-workspace-id'] = res.user.activeWorkspaceId;
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
    if (res?.user?.activeWorkspaceId) {
      customHeaders['x-workspace-id'] = res.user.activeWorkspaceId;
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