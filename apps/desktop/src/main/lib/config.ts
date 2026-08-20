import { app } from 'electron';
import { join } from 'path';
import fs from 'fs';

export interface AppConfig {
  // Build-time
  appName: string;
  version: string;
  packageIdentifier: string;
  releaseChannel: string;
  updaterUrl: string;

  // Runtime
  apiUrl: string;
  openRouterKey?: string;
  aiProvider?: string;

  // User Settings
  settings: {
    modelSelection?: string;
    providerSelection?: string;
    loggingLevel?: string;
    telemetryEnabled?: boolean;
    updateChannel?: string;
  };
}

let cachedConfig: AppConfig | null = null;

export function getLocalConfigPath() {
  return join(app.getPath('userData'), 'config.json');
}

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const pkgVersion = app.getVersion();
  const buildConfig = {
    appName: 'LeadForge OS',
    version: pkgVersion,
    packageIdentifier: 'com.leadforge.os',
    releaseChannel: 'beta',
    updaterUrl: 'https://api.github.com/repos/kjxcodez/leadforge-os/releases/latest'
  };

  let localData: any = {};
  try {
    const configPath = getLocalConfigPath();
    if (fs.existsSync(configPath)) {
      localData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read config.json:', err);
  }

  // Precedence: process.env.API_URL > config.json's apiUrl > Production fallback URL
  let rawApiUrl = process.env.API_URL || localData.apiUrl || 'https://api.leadforge.kapiljangid.pro/api/v1';
  rawApiUrl = rawApiUrl.replace(/\/+$/, '');
  const apiUrl = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;

  cachedConfig = {
    ...buildConfig,
    apiUrl,
    openRouterKey: process.env.OPENROUTER_API_KEY || localData.openRouterKey,
    aiProvider: process.env.AI_PROVIDER || localData.aiProvider || 'mock',
    settings: {
      modelSelection: localData.settings?.modelSelection || 'llama3.1',
      providerSelection: localData.settings?.providerSelection || 'ollama',
      loggingLevel: localData.settings?.loggingLevel || 'info',
      telemetryEnabled: localData.settings?.telemetryEnabled !== false,
      updateChannel: localData.settings?.updateChannel || 'beta'
    }
  };

  return cachedConfig;
}

export function saveConfig(updates: Partial<AppConfig>): void {
  const current = loadConfig();
  const updated = {
    ...current,
    ...updates,
    settings: {
      ...current.settings,
      ...updates.settings
    }
  };

  cachedConfig = updated;

  try {
    const configPath = getLocalConfigPath();
    const toSave = {
      apiUrl: updated.apiUrl,
      aiProvider: updated.aiProvider,
      settings: updated.settings
    };
    fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config.json:', err);
  }
}
