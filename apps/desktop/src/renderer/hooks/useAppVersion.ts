import { useState, useEffect } from 'react';
import { ElectronService } from '../services/electron-service';

/**
 * useAppVersion fetches the Electron application version once on mount.
 */
export function useAppVersion() {
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    ElectronService.getVersion().then(setVersion);
  }, []);

  return { version };
}
