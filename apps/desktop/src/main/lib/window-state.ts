import { app, BrowserWindow, screen } from 'electron';
import fs from 'fs';
import { join } from 'path';

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized: boolean;
}

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

let windowState: WindowState = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  maximized: false
};

let saveTimeout: NodeJS.Timeout | null = null;

function getLocalConfigPath() {
  return join(app.getPath('userData'), 'config.json');
}

export function loadWindowState(): WindowState {
  try {
    const configPath = getLocalConfigPath();
    if (!fs.existsSync(configPath)) {
      return getCenteredDefaultState();
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const saved = config.windowState;
    if (!saved) {
      return getCenteredDefaultState();
    }

    // Validate coordinates against all displays
    const displays = screen.getAllDisplays();
    let isVisible = false;
    if (saved.x !== undefined && saved.y !== undefined) {
      isVisible = displays.some(display => {
        const db = display.bounds;
        return (
          saved.x >= db.x &&
          saved.x < db.x + db.width &&
          saved.y >= db.y &&
          saved.y < db.y + db.height
        );
      });
    }

    if (isVisible) {
      windowState = {
        width: typeof saved.width === 'number' ? saved.width : DEFAULT_WIDTH,
        height: typeof saved.height === 'number' ? saved.height : DEFAULT_HEIGHT,
        x: saved.x,
        y: saved.y,
        maximized: !!saved.maximized
      };
    } else {
      windowState = getCenteredDefaultState();
    }
  } catch (err) {
    console.error('[WindowState] Failed to load window state:', err);
    windowState = getCenteredDefaultState();
  }
  return windowState;
}

function getCenteredDefaultState(): WindowState {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const db = primaryDisplay.bounds;
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: Math.round(db.x + (db.width - DEFAULT_WIDTH) / 2),
      y: Math.round(db.y + (db.height - DEFAULT_HEIGHT) / 2),
      maximized: false
    };
  } catch {
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      maximized: false
    };
  }
}

function saveWindowState(): void {
  try {
    const configPath = getLocalConfigPath();
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    config.windowState = windowState;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('[WindowState] Failed to save window state:', err);
  }
}

export function trackWindowState(win: BrowserWindow): void {
  const updateState = () => {
    try {
      const isMaximized = win.isMaximized();
      const isMinimized = win.isMinimized();
      if (isMinimized) return;

      windowState.maximized = isMaximized;

      if (!isMaximized) {
        const bounds = win.getBounds();
        windowState.x = bounds.x;
        windowState.y = bounds.y;
        windowState.width = bounds.width;
        windowState.height = bounds.height;
      }

      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveWindowState();
      }, 500);
    } catch (err) {
      console.error('[WindowState] Failed to update window state:', err);
    }
  };

  win.on('resize', updateState);
  win.on('move', updateState);
  win.on('maximize', updateState);
  win.on('unmaximize', updateState);
  
  win.on('close', () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    updateState();
    saveWindowState();
  });
}
