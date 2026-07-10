import { useState, useEffect } from 'react';
import { ElectronService } from '../services/electron-service';

/**
 * usePlatform fetches the OS platform identifier once on mount.
 * Returns 'web' when running outside of Electron.
 */
export function usePlatform() {
  const [platform, setPlatform] = useState<string>('web');

  useEffect(() => {
    ElectronService.getPlatform().then(setPlatform);
  }, []);

  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux';

  return { platform, isMac, isWindows, isLinux };
}
