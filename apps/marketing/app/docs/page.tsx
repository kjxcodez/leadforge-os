"use client"

import React, { useState } from "react"
import { motion } from "motion/react"
import { Book, Terminal, Settings, Cpu, Compass, Search, ChevronRight, FileText, ShieldAlert } from "lucide-react"

export default function DocsPage() {
  const [activeArticle, setActiveArticle] = useState<
    "intro" | "install" | "sqlite" | "job_scheduler" | "sync" | "secrets" | "masking" | "adr_overview"
  >("intro")

  const categories = [
    {
      title: "Getting Started",
      items: [
        { id: "intro", title: "Introduction", icon: Book },
        { id: "install", title: "Setup & Installation", icon: Compass }
      ]
    },
    {
      title: "Core Mechanics",
      items: [
        { id: "sqlite", title: "SQLite Concurrency & WAL", icon: Cpu },
        { id: "job_scheduler", title: "Background Job Scheduler", icon: Settings },
        { id: "sync", title: "SQLite-to-Mongo Sync", icon: Settings }
      ]
    },
    {
      title: "Security & Privacy",
      items: [
        { id: "secrets", title: "Secrets & safeStorage", icon: ShieldAlert },
        { id: "masking", title: "Logs Credential Masking", icon: ShieldAlert }
      ]
    },
    {
      title: "Developer Reference",
      items: [
        { id: "adr_overview", title: "Architectural Decision Records", icon: FileText }
      ]
    }
  ]

  const articles = {
    intro: {
      title: "LeadForge OS Documentation",
      category: "Getting Started",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Welcome to the official developer and operator documentation for LeadForge OS. 
            LeadForge OS is a local-first system designed to build, run, and scale outbound lead pipelines 
            directly from your hardware.
          </p>
          <div className="border border-[var(--border-subtle)] bg-[var(--card)] p-4 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold uppercase font-mono tracking-wider text-[var(--primary)]">Key Architectural Concepts</h4>
            <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-disc list-inside leading-relaxed">
              <li><strong className="text-[var(--foreground)]">Local-First:</strong> All scrapers, parsers, and dispatch engines operate on your processor cores. Your keys and leads never leave your disk.</li>
              <li><strong className="text-[var(--foreground)]">SQLite Storage:</strong> A standard local SQLite database in Write-Ahead Log (WAL) mode handles concurrent scraping writes and campaign reads with sub-millisecond locks.</li>
              <li><strong className="text-[var(--foreground)]">SMTP Relays:</strong> Direct connection to your SMTP configurations (SMTP, Google, Office365) without middleman cloud servers.</li>
            </ul>
          </div>
        </div>
      )
    },
    install: {
      title: "Setup & Installation",
      category: "Getting Started",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Configure your local workspace and build the Electron desktop application from source.
          </p>
          
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Prerequisites</h3>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside">
            <li><strong>Node.js:</strong> v18.0.0 or higher (recommended: v20.x or v22.x LTS)</li>
            <li><strong>pnpm:</strong> v8.0.0 or higher</li>
            <li><strong>Git:</strong> Installed and configured</li>
            <li><strong>Ollama (Optional):</strong> For offline Lead Qualification and scoring (`ollama run llama3.1`)</li>
          </ul>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Installation Steps</h3>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4 font-mono text-xs text-[var(--muted-foreground)] space-y-2 leading-relaxed select-all">
            <div># Clone repository</div>
            <div>git clone https://github.com/kjxcodez/leadforge-os.git</div>
            <div>cd leadforge-os</div>
            <div className="pt-2"># Install workspace dependencies</div>
            <div>pnpm install</div>
            <div className="pt-2"># Build shared packages</div>
            <div>pnpm build</div>
            <div className="pt-2"># Run desktop app in development</div>
            <div>pnpm dev --filter=@leadforge/desktop</div>
          </div>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Packaging &amp; Distribution</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            To build a target distribution installer executable for Windows:
          </p>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4 font-mono text-xs text-[var(--muted-foreground)] select-all">
            pnpm package
          </div>
          
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Troubleshooting</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <strong>SQLite DLL Binary Mismatch:</strong> If you receive a binary loading mismatch error for `better_sqlite3`, compile the native driver against the Electron target Node ABI:
          </p>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4 font-mono text-xs text-[var(--muted-foreground)] select-all">
            pnpm -F @leadforge/desktop exec electron-builder install-app-deps
          </div>
        </div>
      )
    },
    sqlite: {
      title: "SQLite Concurrency & WAL",
      category: "Core Mechanics",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            LeadForge OS leverages SQLite in Write-Ahead Log (WAL) mode to coordinate scrapers running in multiple subprocesses.
            This ensures that background scraping tasks never lock the main UI thread during lead enrichment.
          </p>

          <div className="border border-[var(--border-subtle)] bg-[var(--card)] p-4 rounded-lg space-y-3 font-mono text-[11px] text-[var(--text-secondary)]">
            <span className="text-[var(--primary)] font-semibold">PRAGMA journal_mode = WAL;</span>
            <p className="leading-relaxed">
              WAL allows multiple readers to read the database at the same time a writer is active.
              Transactions are written to a separate `.wal` file, which is periodically checkpointed back to the database.
            </p>
          </div>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Multi-Workspace Isolation</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            LeadForge OS isolates different projects by storing them in separate physical SQLite database files: <code>leadforge_&lt;workspaceId&gt;.db</code>. These reside in the OS Roaming data directory.
          </p>
        </div>
      )
    },
    job_scheduler: {
      title: "Background Job Scheduler",
      category: "Core Mechanics",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            The `JobScheduler` in the Electron main process manages headless crawler processes and Playwright instances.
            It ensures parallel tasks run efficiently without causing CPU spikes.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Heartbeat Watchdog</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Every 10 seconds, the main process pings child scraper workers. Scrapers must reply with a `pong` message.
            If a worker stalls or fails to respond within 30 seconds, it is terminated with `SIGKILL` and flagged for retry.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">State Checkpointing</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Long-running scraping jobs regularly save progress offsets to the database. If a job is paused or interrupted,
            it resumes from the last known checkpoint offset rather than restarting from scratch.
          </p>
        </div>
      )
    },
    sync: {
      title: "SQLite-to-Mongo Sync Engine",
      category: "Core Mechanics",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            The sync engine keeps the local desktop database backed up to the cloud api database whenever internet is active.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Sync Protocol</h3>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-decimal list-inside leading-relaxed">
            <li>Any local database insert/update adds a sync request event to the local `sync_queue` table in the same transaction block.</li>
            <li>The `SyncEngine` reads the queue and sends modifications sequentially to the Hono API server using the SDK transport client.</li>
            <li>The Hono server updates the cloud MongoDB instance.</li>
            <li><strong>Conflict Resolution:</strong> Resolves write overlaps using Last-Write-Wins (LWW) based on standard `updatedAt` headers.</li>
          </ul>
        </div>
      )
    },
    secrets: {
      title: "Secrets & safeStorage",
      category: "Security & Privacy",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Sensitive user credentials (SMTP password, OpenRouter API keys) are encrypted before storage.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Keychain Encryption</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            We use Electron's native `safeStorage` API, which leverages Windows Data Protection API (DPAPI) or macOS Keychain.
            Secrets are saved to SQLite prefixed with `_enc_base64:`.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)] font-mono">Test &amp; Headless CLI Fallbacks</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Because tests and background CLI commands run outside the main Electron window context, `safeStorage` is unavailable in those scopes.
            If `isEncryptionAvailable()` is false, the system alerts the developer and falls back to plain-text settings configurations.
          </p>
        </div>
      )
    },
    masking: {
      title: "Logs Credential Masking",
      category: "Security & Privacy",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            LeadForge OS scans all logs to prevent the leakage of credentials in troubleshooting files.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Regex Filtering</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Daily logs written via `@leadforge/logger` filter properties matching secrets keys (e.g. `smtpPassword`, `openRouterKey`).
            Matches are replaced with the `[MASKED]` string representation before being saved to the file system.
          </p>
        </div>
      )
    },
    adr_overview: {
      title: "Architectural Decision Records (ADRs)",
      category: "Developer Reference",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Overview registry of design architecture decisions made during LeadForge OS development.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--card)]">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">ADR-001: Runtime Responsibilities</h4>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Isolates scraper worker subprocesses from the Electron UI thread to protect rendering loops.</p>
            </div>
            <div className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--card)]">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">ADR-004: Memory Model</h4>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Configures a maximum 800MB RSS memory ceiling for workers, terminating bloated Playwright instances.</p>
            </div>
            <div className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--card)]">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">ADR-007: Dependency Rules</h4>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Maintains package layout isolation, ensuring `schema` and `core` remain decoupled from API/desktop shells.</p>
            </div>
            <div className="border border-[var(--border-subtle)] rounded p-3 bg-[var(--card)]">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">ADR-011: Sync Architecture</h4>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Defines SQLite mutation event capturing using local queues to support offline capabilities.</p>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="container mx-auto px-6 py-20 min-h-[85vh] text-left">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-10">
        
        {/* Sidebar Nav */}
        <div className="space-y-8 select-none">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search documentation..." 
              disabled
              className="w-full h-8 pl-8 pr-2 rounded bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] pointer-events-none"
            />
            <Search className="absolute left-2.5 top-[9px] h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          </div>

          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat.title} className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                  {cat.title}
                </h4>
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const isActive = activeArticle === item.id
                    const IconComp = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveArticle(item.id as any)}
                        className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors duration-150 cursor-pointer ${
                          isActive 
                            ? "bg-[var(--card)] text-[var(--foreground)] border-l-2 border-[var(--primary)] pl-[8px]" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5" />
                        {item.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Panel */}
        <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
          <div className="border-b border-[var(--border-subtle)] pb-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--primary)]">
              {articles[activeArticle].category}
            </span>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              {articles[activeArticle].title}
            </h1>
          </div>

          <div className="min-h-[300px]">
            {articles[activeArticle].content}
          </div>
        </div>

      </div>
    </div>
  )
}
