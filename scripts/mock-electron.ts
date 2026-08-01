import path from 'path';

// Define Mock Electron
export const mockElectron = {
  app: {
    getPath: (name: string) => {
      const tempDir = path.resolve(__dirname, '..', 'report', 'temp-smoke');
      return tempDir;
    },
    isPackaged: false,
    setAppUserModelId: () => {}
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  ipcMain: {
    on: () => {},
    handle: () => {}
  }
};

// Insert Mock into require cache
const resolvePath = require.resolve('electron');
require.cache[resolvePath] = {
  id: 'electron',
  filename: resolvePath,
  loaded: true,
  exports: mockElectron,
  paths: []
} as any;
