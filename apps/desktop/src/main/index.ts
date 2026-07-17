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

  // Show window when ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (is.dev) {
      mainWindow?.webContents.openDevTools({
        mode: "detach"
      });
    }

    // Inject E2E verification triggers for Contacts
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[TEST-RUNNER] Injecting E2E Contact bootstrap & creation script...');
        mainWindow.webContents.executeJavaScript(`
          (async () => {
            console.log('[E2E-TEST] Starting E2E bootstrap & trace...');
            try {
              // 1. Try to login. If it fails, try to register!
              let authRes;
              try {
                console.log('[E2E-TEST] [auth:login] Attempting login with test@leadforge.io...');
                authRes = await window.ipc.invoke('auth:login', {
                  email: 'test@leadforge.io',
                  password: 'Password123!'
                });
                console.log('[E2E-TEST] [auth:login] Success!');
              } catch (loginErr) {
                console.log('[E2E-TEST] [auth:login] Failed, attempting registration...');
                authRes = await window.ipc.invoke('auth:register', {
                  email: 'test@leadforge.io',
                  password: 'Password123!',
                  name: 'Test User'
                });
                console.log('[E2E-TEST] [auth:register] Success!');
              }

              // 2. Load workspaces
              console.log('[E2E-TEST] [workspaces:list] Fetching workspaces...');
              let workspaces = await window.ipc.invoke('workspaces:list');
              console.log('[E2E-TEST] [workspaces:list] Found:', workspaces.length);

              let workspaceId = '';
              if (workspaces.length === 0) {
                console.log('[E2E-TEST] [workspaces:create] Creating new workspace...');
                const newWorkspace = await window.ipc.invoke('workspaces:create', {
                  name: 'Default Test Workspace'
                });
                workspaceId = newWorkspace.id || newWorkspace._id;
                console.log('[E2E-TEST] [workspaces:create] Created:', workspaceId);
              } else {
                workspaceId = workspaces[0].id || workspaces[0]._id;
              }

              // 3. Set active workspace
              console.log('[E2E-TEST] [electron:setActiveWorkspace] Activating workspace:', workspaceId);
              await window.ipc.invoke('electron:setActiveWorkspace', workspaceId);

              // Wait for active workspace context to propagate
              await new Promise(r => setTimeout(r, 2000));

              const activeWorkspace = await window.ipc.invoke('electron:getActiveWorkspace');
              console.log('[E2E-TEST] [electron:getActiveWorkspace] Active Workspace ID:', activeWorkspace);

              // 4. Try to invoke contacts:create with empty optional inputs
              console.log('[E2E-TEST] [contacts:create] Invoking creation with empty inputs...');
              const result = await window.ipc.invoke('contacts:create', {
                firstName: 'John',
                lastName: 'Doe',
                email: '',
                phone: '',
                companyId: '',
                status: 'NEW',
                title: 'VP of Sales',
                notes: 'Test contact notes',
                source: 'manual'
              });
              console.log('[E2E-TEST] [contacts:create] Success:', JSON.stringify(result));
            } catch (err) {
              console.error('[E2E-TEST] [CRITICAL-ERROR] Tracing failed:', err.message);
            }
          })()
        `).catch(err => {
          console.error('[TEST-RUNNER] executeJavaScript failed:', err);
        });
      }
    }, 12000);
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
  // Set as app user model ID (Windows)
  app.setAppUserModelId('com.leadforge.desktop');

  // Restore session from disk
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