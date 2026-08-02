"use client"

import React, { useState } from "react"
import { motion } from "motion/react"
import { Book, Terminal, Settings, Cpu, Compass, Search, ChevronRight, FileText } from "lucide-react"

export default function DocsPage() {
  const [activeArticle, setActiveArticle] = useState<"intro" | "install" | "sqlite" | "smtp" | "cli">("intro")

  const categories = [
    {
      title: "Getting Started",
      items: [
        { id: "intro", title: "Introduction", icon: Book },
        { id: "install", title: "Installation Guide", icon: Compass }
      ]
    },
    {
      title: "Core Mechanics",
      items: [
        { id: "sqlite", title: "Local SQLite WAL", icon: Cpu },
        { id: "smtp", title: "SMTP Configuration", icon: Settings }
      ]
    },
    {
      title: "Developer Reference",
      items: [
        { id: "cli", title: "CLI Tooling", icon: Terminal }
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
      title: "Installation & Setup",
      category: "Getting Started",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Deploy the LeadForge executable or set up the development environment from source.
          </p>
          
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Precompiled Binary</h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Download the installer from the <a href="/download" className="text-[var(--primary)] underline font-mono">Download page</a>.
            Launch the `.exe` (Windows) and configure your primary workspace directory.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)] font-mono">Dev Setup</h3>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4 font-mono text-xs text-[var(--muted-foreground)] leading-relaxed select-all">
            git clone https://github.com/leadforge-os/leadforge-os.git<br />
            cd leadforge-os<br />
            pnpm install<br />
            pnpm --filter desktop start
          </div>
        </div>
      )
    },
    sqlite: {
      title: "SQLite Write-Ahead Logging (WAL)",
      category: "Core Mechanics",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            LeadForge OS leverages SQLite in WAL mode to coordinate scrapers running in multiple subprocesses.
            This ensures that background scraping tasks never lock the main UI thread during lead enrichment.
          </p>

          <div className="border border-[var(--border-subtle)] bg-[var(--card)] p-4 rounded-lg space-y-3 font-mono text-[11px] text-[var(--text-secondary)]">
            <span className="text-[var(--primary)] font-semibold">PRAGMA journal_mode = WAL;</span>
            <p className="leading-relaxed">
              WAL allows multiple readers to read the database at the same time a writer is active.
              Transactions are written to a separate `.wal` file, which is periodically checkpointed back to the database.
            </p>
          </div>
        </div>
      )
    },
    smtp: {
      title: "Direct SMTP Configurations",
      category: "Core Mechanics",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Unlike traditional cloud CRM platforms, LeadForge connects directly to your own SMTP configurations.
            Your API keys and credentials are encrypted on-disk using AES-256-GCM.
          </p>

          <h3 className="text-sm font-semibold text-[var(--foreground)]">Adding a SMTP Sender</h3>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-decimal list-inside leading-relaxed">
            <li>Navigate to settings in the desktop application.</li>
            <li>Input the host address, port, and credentials.</li>
            <li>Confirm SMTP TLS version handshake.</li>
          </ul>
        </div>
      )
    },
    cli: {
      title: "CLI Reference Tooling",
      category: "Developer Reference",
      content: (
        <div className="space-y-6">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            LeadForge OS features an embedded CLI tool `leadforge-cli` for triggering background scrapers,
            database backups, or synchronizing with cloud configurations from terminal environments.
          </p>
          
          <h3 className="text-sm font-semibold text-[var(--foreground)]">CLI Commands</h3>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-md p-4 font-mono text-xs text-[var(--muted-foreground)] space-y-2 leading-relaxed">
            <div>
              <span className="text-[var(--primary)]">$ leadforge-cli scrape --query "HVAC in Brooklyn"</span>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Triggers Google Maps &amp; WHOIS scrapers locally.</p>
            </div>
            <div>
              <span className="text-[var(--primary)]">$ leadforge-cli db sync</span>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Checkpoints the WAL file and syncs leads database with your remote backup server.</p>
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
        <div className="space-y-8">
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
