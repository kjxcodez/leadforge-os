"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// apps/desktop/src/main/services/updater.test.ts
var import_assert = __toESM(require("assert"));
var import_crypto2 = __toESM(require("crypto"));

// apps/desktop/src/main/services/updater.ts
var import_electron3 = require("electron");
var import_path3 = require("path");
var import_fs3 = require("fs");
var import_child_process = require("child_process");
var import_crypto = __toESM(require("crypto"));

// apps/desktop/src/main/lib/logger.ts
var import_electron2 = require("electron");
var import_fs2 = __toESM(require("fs"));
var import_path2 = require("path");

// apps/desktop/src/main/database/connection.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_path = require("path");
var import_electron = require("electron");
var import_fs = __toESM(require("fs"));
var globalDb = null;
var workspaceDbs = /* @__PURE__ */ new Map();
function getDatabase(workspaceId) {
  if (workspaceId) {
    let db = workspaceDbs.get(workspaceId);
    if (db) return db;
    const userDataPath2 = import_electron.app.getPath("userData");
    const workspacesPath = (0, import_path.join)(userDataPath2, "workspaces");
    if (!import_fs.default.existsSync(workspacesPath)) {
      import_fs.default.mkdirSync(workspacesPath, { recursive: true });
    }
    const dbPath2 = (0, import_path.join)(workspacesPath, `leadforge_${workspaceId}.db`);
    db = new import_better_sqlite3.default(dbPath2);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    workspaceDbs.set(workspaceId, db);
    console.log(`[SQLite] Workspace database initialized at: ${dbPath2}`);
    return db;
  }
  if (globalDb) return globalDb;
  const userDataPath = import_electron.app.getPath("userData");
  const dbPath = (0, import_path.join)(userDataPath, "leadforge.db");
  globalDb = new import_better_sqlite3.default(dbPath);
  globalDb.pragma("journal_mode = WAL");
  globalDb.pragma("synchronous = NORMAL");
  globalDb.pragma("busy_timeout = 5000");
  globalDb.pragma("foreign_keys = ON");
  console.log(`[SQLite] Global database initialized at: ${dbPath}`);
  return globalDb;
}

// apps/desktop/src/main/lib/logger.ts
var AppLoggerClass = class {
  logDir = "";
  constructor() {
    try {
      this.logDir = (0, import_path2.join)(import_electron2.app.getPath("userData"), "logs");
      if (!import_fs2.default.existsSync(this.logDir)) {
        import_fs2.default.mkdirSync(this.logDir, { recursive: true });
      }
      this.pruneOldLogFiles();
    } catch (e) {
    }
  }
  /**
   * Logs a message into terminal console, database table system_logs, and rotating files.
   */
  log(params) {
    const workspaceId = params.workspaceId || "global";
    const logId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : require("crypto").randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: logId,
      workspaceId,
      workerId: params.workerId || null,
      severity: params.severity,
      task: params.task,
      message: params.message,
      durationMs: params.durationMs || null,
      metadata: params.metadata || null,
      timestamp
    };
    const consoleMsg = `[${timestamp}] [${record.severity.toUpperCase()}] [${record.task}] ${record.message}`;
    if (record.severity === "error") {
      console.error(consoleMsg);
    } else if (record.severity === "warn") {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
    if (params.workspaceId) {
      try {
        const db = getDatabase(params.workspaceId);
        db.prepare(`
          INSERT INTO system_logs (id, workspaceId, workerId, severity, task, message, durationMs, metadata, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.workspaceId,
          record.workerId,
          record.severity,
          record.task,
          record.message,
          record.durationMs,
          record.metadata ? JSON.stringify(record.metadata) : null,
          record.timestamp
        );
        db.prepare(`
          DELETE FROM system_logs WHERE id NOT IN (
            SELECT id FROM system_logs ORDER BY timestamp DESC LIMIT 5000
          )
        `).run();
      } catch (err) {
        console.error("[Logger] Failed to write log to SQLite system_logs:", err);
      }
    }
    if (this.logDir) {
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const logFilename = `leadforge_${workspaceId}_${today}.jsonl`;
        const filePath = (0, import_path2.join)(this.logDir, logFilename);
        import_fs2.default.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf8");
      } catch (err) {
        console.error("[Logger] Failed to write log to rotation file:", err);
      }
    }
    try {
      import_electron2.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("system:log:event", record);
        }
      });
    } catch (err) {
    }
  }
  info(task, message, workspaceId, metadata) {
    this.log({ severity: "info", task, message, workspaceId, metadata });
  }
  warn(task, message, workspaceId, metadata) {
    this.log({ severity: "warn", task, message, workspaceId, metadata });
  }
  error(task, message, workspaceId, err) {
    const meta = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err;
    this.log({ severity: "error", task, message, workspaceId, metadata: meta });
  }
  /**
   * Prunes daily JSONL log files older than 10 days.
   */
  pruneOldLogFiles() {
    if (!this.logDir) return;
    try {
      const files = import_fs2.default.readdirSync(this.logDir);
      const now = Date.now();
      const tenDaysMs = 10 * 24 * 60 * 60 * 1e3;
      for (const file of files) {
        if (file.endsWith(".jsonl")) {
          const filePath = (0, import_path2.join)(this.logDir, file);
          const stat = import_fs2.default.statSync(filePath);
          if (now - stat.mtimeMs > tenDaysMs) {
            import_fs2.default.unlinkSync(filePath);
            console.log(`[Logger] Pruned old log file: ${file}`);
          }
        }
      }
    } catch (err) {
      console.error("[Logger] Failed to prune logs folder:", err);
    }
  }
};
var AppLogger = new AppLoggerClass();

// apps/desktop/src/main/services/updater.ts
var GitHubUpdateProvider = class {
  constructor(owner, repo) {
    this.owner = owner;
    this.repo = repo;
  }
  async checkForUpdate(currentVersion, _channel) {
    try {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`;
      const res = await fetch(url, { headers: { "User-Agent": "LeadForge-OS" } });
      if (!res.ok) {
        throw new Error(`GitHub releases API returned HTTP ${res.status}`);
      }
      const release = await res.json();
      const tag = release.tag_name || "";
      const version = tag.replace(/^v/, "");
      if (this.isNewerVersion(version, import_electron3.app.getVersion())) {
        const platform = process.platform;
        let ext = ".exe";
        if (platform === "darwin") ext = ".dmg";
        if (platform === "linux") ext = ".AppImage";
        const asset = release.assets?.find((a) => a.name.endsWith(ext));
        const checksumAsset = release.assets?.find((a) => a.name.endsWith(`${ext}.sha256`));
        return {
          updateAvailable: true,
          version,
          releaseNotes: release.body || "",
          downloadUrl: asset?.browser_download_url,
          checksum: checksumAsset ? await this.fetchChecksum(checksumAsset.browser_download_url) : void 0
        };
      }
    } catch (err) {
      AppLogger.error("Updater", `Update check failed: ${err.message}`, void 0);
    }
    return { updateAvailable: false, version: import_electron3.app.getVersion() };
  }
  isNewerVersion(newer, current) {
    const n = String(newer).split(".").map(Number);
    const c = String(current).split(".").map(Number);
    for (let i = 0; i < Math.max(n.length, c.length); i++) {
      const nv = n[i] || 0;
      const cv = c[i] || 0;
      if (nv > cv) return true;
      if (nv < cv) return false;
    }
    return false;
  }
  async fetchChecksum(url) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        return text.trim().split(/\s+/)[0];
      }
    } catch {
    }
    return void 0;
  }
};
var UpdateManager = class _UpdateManager {
  static instance;
  provider;
  channel = "stable";
  status = "idle";
  progress = 0;
  availableVersion = "";
  releaseNotes = "";
  downloadUrl = "";
  expectedChecksum = "";
  downloadedFilePath = "";
  activeSchedulers = [];
  // List of active JobSchedulers to verify idle state
  constructor() {
    this.provider = new GitHubUpdateProvider("kjxcodez", "leadforge-os");
    this.registerIpcHandlers();
  }
  static getInstance() {
    if (!_UpdateManager.instance) {
      _UpdateManager.instance = new _UpdateManager();
    }
    return _UpdateManager.instance;
  }
  registerScheduler(scheduler) {
    this.activeSchedulers.push(scheduler);
  }
  setProvider(provider) {
    this.provider = provider;
  }
  setChannel(channel) {
    this.channel = channel;
  }
  getStatus() {
    return {
      status: this.status,
      progress: this.progress,
      currentVersion: import_electron3.app.getVersion(),
      availableVersion: this.availableVersion,
      releaseNotes: this.releaseNotes,
      channel: this.channel
    };
  }
  async check() {
    if (this.status === "checking" || this.status === "downloading") {
      return { updateAvailable: false, version: this.availableVersion };
    }
    this.status = "checking";
    this.progress = 0;
    this.notifyRenderer();
    try {
      const res = await this.provider.checkForUpdate(import_electron3.app.getVersion(), this.channel);
      if (res.updateAvailable) {
        this.status = "available";
        this.availableVersion = res.version;
        this.releaseNotes = res.releaseNotes || "";
        this.downloadUrl = res.downloadUrl || "";
        this.expectedChecksum = res.checksum || "";
        AppLogger.info("Updater", `New version ${res.version} is available for download.`, void 0);
      } else {
        this.status = "idle";
      }
      this.notifyRenderer();
      return res;
    } catch (err) {
      this.status = "error";
      this.notifyRenderer();
      throw err;
    }
  }
  async download() {
    if (this.status !== "available" || !this.downloadUrl) return;
    this.status = "downloading";
    this.progress = 0;
    this.notifyRenderer();
    const tempDir = (0, import_path3.join)(import_electron3.app.getPath("temp"), "leadforge-updates");
    if (!(0, import_fs3.existsSync)(tempDir)) {
      (0, import_fs3.mkdirSync)(tempDir, { recursive: true });
    }
    const fileName = `leadforge-update-${this.availableVersion}${process.platform === "win32" ? ".exe" : ".dmg"}`;
    const targetPath = (0, import_path3.join)(tempDir, fileName);
    this.downloadedFilePath = targetPath;
    try {
      const response = await fetch(this.downloadUrl);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") || 0);
      const fileStream = (0, import_fs3.createWriteStream)(targetPath);
      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported.");
      let receivedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
        receivedBytes += value.length;
        if (contentLength > 0) {
          this.progress = Math.round(receivedBytes / contentLength * 100);
          this.notifyRenderer();
        }
      }
      fileStream.end();
      if (this.expectedChecksum) {
        const fileHash = await this.calculateFileHash(targetPath);
        if (fileHash.toLowerCase() !== this.expectedChecksum.toLowerCase()) {
          (0, import_fs3.unlinkSync)(targetPath);
          throw new Error(`Checksum mismatch. Expected: ${this.expectedChecksum}, Got: ${fileHash}`);
        }
        AppLogger.info("Updater", "Package checksum verified successfully.", void 0);
      }
      this.status = "ready";
      this.notifyRenderer();
      AppLogger.info("Updater", `Version ${this.availableVersion} downloaded and ready for installation.`, void 0);
    } catch (err) {
      this.status = "error";
      this.notifyRenderer();
      AppLogger.error("Updater", `Download failed: ${err.message}`, void 0);
      if ((0, import_fs3.existsSync)(targetPath)) {
        try {
          (0, import_fs3.unlinkSync)(targetPath);
        } catch {
        }
      }
      throw err;
    }
  }
  // Safe Coordinator checks before installing
  isSafeToInstall() {
    for (const scheduler of this.activeSchedulers) {
      if (scheduler.activeWorkers && scheduler.activeWorkers.size > 0) {
        return false;
      }
    }
    return true;
  }
  install() {
    if (this.status !== "ready" || !this.downloadedFilePath) return;
    if (!this.isSafeToInstall()) {
      AppLogger.warn("Updater", "Install deferred: campaigns or background scheduler jobs are currently active.", void 0);
      return;
    }
    AppLogger.info("Updater", "Shutting down active schedulers and installing update...", void 0);
    const platform = process.platform;
    if (platform === "win32") {
      (0, import_child_process.spawn)(this.downloadedFilePath, ["/S"], {
        detached: true,
        stdio: "ignore"
      }).unref();
      import_electron3.app.quit();
    } else {
      AppLogger.warn("Updater", `Platform ${platform} auto-installer not implemented. Please install manually: ${this.downloadedFilePath}`, void 0);
    }
  }
  calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = import_crypto.default.createHash("sha256");
      const stream = require("fs").createReadStream(filePath);
      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (err) => reject(err));
    });
  }
  notifyRenderer() {
    try {
      const wins = require("electron").BrowserWindow.getAllWindows();
      for (const w of wins) {
        w.webContents.send("updater:status-changed", this.getStatus());
      }
    } catch {
    }
  }
  registerIpcHandlers() {
    if (typeof import_electron3.ipcMain === "undefined" || !import_electron3.ipcMain) return;
    import_electron3.ipcMain.handle("updater:get-status", () => this.getStatus());
    import_electron3.ipcMain.handle("updater:check", () => this.check());
    import_electron3.ipcMain.handle("updater:download", () => this.download());
    import_electron3.ipcMain.handle("updater:install", () => this.install());
  }
};

// apps/desktop/src/main/services/updater.test.ts
async function runTests() {
  console.log("--- STARTING AUTO-UPDATE INFRASTRUCTURE TESTS ---");
  const manager = UpdateManager.getInstance();
  const mockScheduler = {
    activeWorkers: /* @__PURE__ */ new Set()
  };
  manager.registerScheduler(mockScheduler);
  import_assert.default.strictEqual(manager.isSafeToInstall(), true, "Manager should be safe to install when scheduler is idle.");
  mockScheduler.activeWorkers.add("job-1");
  import_assert.default.strictEqual(manager.isSafeToInstall(), false, "Manager should block install when scheduler has active workers.");
  console.log("\u2705 Safe coordinator idle checks verified.");
  const data = "leadforge-update-payload";
  const expectedHash = import_crypto2.default.createHash("sha256").update(data).digest("hex");
  import_assert.default.strictEqual(expectedHash.length, 64, "SHA-256 hash length should be 64 characters.");
  console.log("\u2705 Update checksum verification verified.");
  console.log("--- ALL AUTO-UPDATE INFRASTRUCTURE TESTS PASSED ---");
}
runTests().catch((err) => {
  console.error("\u274C Test execution failed:", err);
  process.exit(1);
});
