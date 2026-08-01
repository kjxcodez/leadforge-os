import { app, ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { AppLogger } from '../lib/logger';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  version: string;
  releaseNotes?: string;
  downloadUrl?: string;
  checksum?: string | undefined;
}

export interface UpdateProvider {
  checkForUpdate(currentVersion: string, channel: string): Promise<UpdateCheckResult>;
}

// Initial GitHub Release Provider implementation
export class GitHubUpdateProvider implements UpdateProvider {
  constructor(
    private owner: string,
    private repo: string
  ) {}

  async checkForUpdate(currentVersion: string, _channel: string): Promise<UpdateCheckResult> {
    try {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`;
      const res = await fetch(url, { headers: { 'User-Agent': 'LeadForge-OS' } });
      if (!res.ok) {
        throw new Error(`GitHub releases API returned HTTP ${res.status}`);
      }

      const release = (await res.json()) as any;
      const tag = release.tag_name || '';
      const version = tag.replace(/^v/, '');

      if (this.isNewerVersion(version, app.getVersion())) {
        const platform = process.platform;
        let ext = '.exe';
        if (platform === 'darwin') ext = '.dmg';
        if (platform === 'linux') ext = '.AppImage';

        const asset = release.assets?.find((a: any) => a.name.endsWith(ext));
        const checksumAsset = release.assets?.find((a: any) => a.name.endsWith(`${ext}.sha256`));

        return {
          updateAvailable: true,
          version,
          releaseNotes: release.body || '',
          downloadUrl: asset?.browser_download_url,
          checksum: checksumAsset
            ? await this.fetchChecksum(checksumAsset.browser_download_url)
            : undefined
        };
      }
    } catch (err: any) {
      AppLogger.error('Updater', `Update check failed: ${err.message}`, undefined);
    }
    return { updateAvailable: false, version: app.getVersion() };
  }

  private isNewerVersion(newer: string, current: string): boolean {
    const parse = (v: string) => {
      const [main = '', prerelease = ''] = v.split('-');
      const parts = main.split('.').map(Number);
      return { parts, prerelease };
    };

    const n = parse(newer);
    const c = parse(current);

    for (let i = 0; i < Math.max(n.parts.length, c.parts.length); i++) {
      const nv = n.parts[i] || 0;
      const cv = c.parts[i] || 0;
      if (nv > cv) return true;
      if (nv < cv) return false;
    }

    if (n.prerelease && !c.prerelease) return false;
    if (!n.prerelease && c.prerelease) return true;
    if (n.prerelease && c.prerelease) {
      return n.prerelease.localeCompare(c.prerelease, undefined, { numeric: true, sensitivity: 'base' }) > 0;
    }

    return false;
  }

  private async fetchChecksum(url: string): Promise<string | undefined> {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        return text.trim().split(/\s+/)[0];
      }
    } catch {
      // ignore
    }
    return undefined;
  }
}

// Background Update Manager and Safe Installation Coordinator
export class UpdateManager {
  private static instance: UpdateManager;
  private provider: UpdateProvider;
  private channel = 'stable';
  private status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' = 'idle';
  private progress = 0;
  private availableVersion = '';
  private releaseNotes = '';
  private downloadUrl = '';
  private expectedChecksum = '';
  private downloadedFilePath = '';
  private activeSchedulers: any[] = []; // List of active JobSchedulers to verify idle state

  private constructor() {
    // Initialise with GitHub Releases provider
    this.provider = new GitHubUpdateProvider('kjxcodez', 'leadforge-os');
    this.registerIpcHandlers();
  }

  public static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  public registerScheduler(scheduler: any): void {
    this.activeSchedulers.push(scheduler);
  }

  public setProvider(provider: UpdateProvider): void {
    this.provider = provider;
  }

  public setChannel(channel: string): void {
    this.channel = channel;
  }

  public getStatus() {
    return {
      status: this.status,
      progress: this.progress,
      currentVersion: app.getVersion(),
      availableVersion: this.availableVersion,
      releaseNotes: this.releaseNotes,
      channel: this.channel
    };
  }

  public async check(): Promise<UpdateCheckResult> {
    if (this.status === 'checking' || this.status === 'downloading') {
      return { updateAvailable: false, version: this.availableVersion };
    }

    this.status = 'checking';
    this.progress = 0;
    this.notifyRenderer();

    try {
      const res = await this.provider.checkForUpdate(app.getVersion(), this.channel);
      if (res.updateAvailable) {
        this.status = 'available';
        this.availableVersion = res.version;
        this.releaseNotes = res.releaseNotes || '';
        this.downloadUrl = res.downloadUrl || '';
        this.expectedChecksum = res.checksum || '';
        AppLogger.info(
          'Updater',
          `New version ${res.version} is available for download.`,
          undefined
        );
      } else {
        this.status = 'idle';
      }
      this.notifyRenderer();
      return res;
    } catch (err: any) {
      this.status = 'error';
      this.notifyRenderer();
      throw err;
    }
  }

  public async download(): Promise<void> {
    if (this.status !== 'available' || !this.downloadUrl) return;

    this.status = 'downloading';
    this.progress = 0;
    this.notifyRenderer();

    const tempDir = join(app.getPath('temp'), 'leadforge-updates');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `leadforge-update-${this.availableVersion}${process.platform === 'win32' ? '.exe' : '.dmg'}`;
    const targetPath = join(tempDir, fileName);
    this.downloadedFilePath = targetPath;

    try {
      const response = await fetch(this.downloadUrl);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      const contentLength = Number(response.headers.get('content-length') || 0);

      const fileStream = createWriteStream(targetPath);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported.');

      let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(value);
        receivedBytes += value.length;
        if (contentLength > 0) {
          this.progress = Math.round((receivedBytes / contentLength) * 100);
          this.notifyRenderer();
        }
      }
      fileStream.end();

      // Verify checksum
      if (this.expectedChecksum) {
        const fileHash = await this.calculateFileHash(targetPath);
        if (fileHash.toLowerCase() !== this.expectedChecksum.toLowerCase()) {
          unlinkSync(targetPath);
          throw new Error(
            `Checksum mismatch. Expected: ${this.expectedChecksum}, Got: ${fileHash}`
          );
        }
        AppLogger.info('Updater', 'Package checksum verified successfully.', undefined);
      }

      this.status = 'ready';
      this.notifyRenderer();
      AppLogger.info(
        'Updater',
        `Version ${this.availableVersion} downloaded and ready for installation.`,
        undefined
      );
    } catch (err: any) {
      this.status = 'error';
      this.notifyRenderer();
      AppLogger.error('Updater', `Download failed: ${err.message}`, undefined);
      if (existsSync(targetPath)) {
        try {
          unlinkSync(targetPath);
        } catch {}
      }
      throw err;
    }
  }

  // Safe Coordinator checks before installing
  public isSafeToInstall(): boolean {
    for (const scheduler of this.activeSchedulers) {
      if (scheduler.activeWorkers && scheduler.activeWorkers.size > 0) {
        return false;
      }
    }
    return true;
  }

  public install(): void {
    if (this.status !== 'ready' || !this.downloadedFilePath) return;

    if (!this.isSafeToInstall()) {
      AppLogger.warn(
        'Updater',
        'Install deferred: campaigns or background scheduler jobs are currently active.',
        undefined
      );
      return;
    }

    AppLogger.info(
      'Updater',
      'Shutting down active schedulers and installing update...',
      undefined
    );

    const platform = process.platform;
    if (platform === 'win32') {
      spawn(this.downloadedFilePath, ['/S'], {
        detached: true,
        stdio: 'ignore'
      }).unref();
      app.quit();
    } else {
      AppLogger.warn(
        'Updater',
        `Platform ${platform} auto-installer not implemented. Please install manually: ${this.downloadedFilePath}`,
        undefined
      );
    }
  }

  private calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(filePath);
      stream.on('data', (data: any) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err: any) => reject(err));
    });
  }

  private notifyRenderer(): void {
    try {
      const wins = require('electron').BrowserWindow.getAllWindows();
      for (const w of wins) {
        w.webContents.send('updater:status-changed', this.getStatus());
      }
    } catch {}
  }

  private registerIpcHandlers(): void {
    if (typeof ipcMain === 'undefined' || !ipcMain) return;
    ipcMain.handle('updater:get-status', () => this.getStatus());
    ipcMain.handle('updater:check', () => this.check());
    ipcMain.handle('updater:download', () => this.download());
    ipcMain.handle('updater:install', () => this.install());
  }
}
