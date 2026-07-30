import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs';
import { is } from '@electron-toolkit/utils';
import { SdkClient } from '@leadforge/sdk';
import { runMigrations } from './database/runner';
import { closeDatabase } from './database/connection';
import { registerAllIpc } from './ipc/register';
import { loadSession, clearSession } from './lib/session';
import { AppLogger } from './lib/logger';
import { loadWindowState, trackWindowState } from './lib/window-state';
import { createSplashWindow } from './lib/splash-window';
import { telemetry } from './lib/telemetry';

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
  onUnauthorized: () => {
    AppLogger.warn('auth', 'Session expired');
    clearSession();
    activeToken = null;
    delete customHeaders['x-workspace-id'];
    persistActiveWorkspace(null);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:unauthorized');
    }
  }
});

// IPC handlers registry
export const ipcHandlers = new Map<string, (event: Electron.IpcMainEvent, ...args: unknown[]) => void>();

function createWindow() {
  const windowState = loadWindowState();

  const winOptions: any = {
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      disableBlinkFeatures: 'Auxclick',
    },
    titleBarStyle: 'default',
    frame: true,
    trafficLightPosition: { x: 10, y: 10 },
  };

  if (windowState.x !== undefined && windowState.y !== undefined) {
    winOptions.x = windowState.x;
    winOptions.y = windowState.y;
  }

  mainWindow = new BrowserWindow(winOptions);

  if (windowState.maximized) {
    mainWindow.maximize();
  }

  trackWindowState(mainWindow);

  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[Renderer Console] ${message}`);
  });

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready (NO-OP: Main window visibility is managed dynamically by renderer ready-to-show IPC)
  mainWindow.on('ready-to-show', () => {
    if (is.dev) {
      mainWindow?.webContents.openDevTools({
        mode: "detach"
      });
    }
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

export function registerIpcHandler() { }


// App lifecycle
app.whenReady().then(() => {
  telemetry.whenReadyTime = Date.now();

  // Create lightweight native splash window immediately
  createSplashWindow();

  // Set as app user model ID (Windows)
  app.setAppUserModelId('com.leadforge.desktop');

  // Restore session from disk
  const sessionStart = Date.now();
  try {
    const session = loadSession();
    if (session) {
      activeToken = session.accessToken;
      const persistedWorkspace = getPersistedActiveWorkspace();
      const workspaceId = persistedWorkspace || session.activeWorkspaceId;
      if (workspaceId) {
        customHeaders['x-workspace-id'] = workspaceId;
      }
      AppLogger.info('auth', 'Session restored');
    }
  } catch (err) {
    AppLogger.error('auth', 'Failed to restore session on startup', undefined, err);
  }
  telemetry.sessionRestoreDuration = Date.now() - sessionStart;

  // 1. Run SQLite schema migrations
  try {
    runMigrations();
  } catch (err) {
    console.error('Failed to run local SQLite migrations:', err);
  }

  // 2. Register all IPC handlers exactly once using the coordinator
  registerAllIpc(
    sdk,
    customHeaders,
    (token) => { activeToken = token; },
    persistActiveWorkspace,
    getPersistedActiveWorkspace
  );

  // Synchronous settings getter for theme/sidebar restore on boot
  ipcMain.on('settings:getSync', (event) => {
    try {
      const configPath = getLocalConfigPath();
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        event.returnValue = config.settings || {};
      } else {
        event.returnValue = {};
      }
    } catch (err) {
      console.error('Failed to get sync settings:', err);
      event.returnValue = {};
    }
  });

  // Asynchronous settings setter
  ipcMain.on('settings:set', (_event, settings) => {
    try {
      const configPath = getLocalConfigPath();
      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
        : {};
      config.settings = { ...(config.settings || {}), ...settings };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to set settings:', err);
    }
  });

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Optimize for OS
  if (process.platform === 'darwin') {
    // macOS specific menu setup can go here
  }

  createWindow();

  // Initialise UpdateManager
  try {
    const { UpdateManager } = require('./services/updater');
    UpdateManager.getInstance();
  } catch (err) {
    AppLogger.error('Updater', 'Failed to initialize UpdateManager on start', undefined, err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Graceful exit handler
app.on('will-quit', () => {
  closeDatabase();
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});