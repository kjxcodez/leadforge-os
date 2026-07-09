import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';

// Main window reference
let mainWindow: BrowserWindow | null = null;

// IPC handlers registry
const ipcHandlers = new Map<string, (event: Electron.IpcMainEvent, ...args: unknown[]) => void>();

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

// IPC event handlers
ipcMain.handle('ipc:test', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Register IPC handler
function registerIpcHandler(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => void | Promise<void>) {
  ipcHandlers.set(channel, handler as unknown as (event: Electron.IpcMainEvent, ...args: unknown[]) => void);
}

// Export for IPC module
export { registerIpcHandler, ipcHandlers };

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