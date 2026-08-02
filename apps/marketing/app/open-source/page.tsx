"use client"

import React from "react"
import { motion } from "motion/react"
import { Code, Terminal, Heart } from "lucide-react"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function OpenSourcePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
  }

  const childVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } }
  }

  return (
    <div className="container mx-auto px-6 py-20 min-h-[85vh] text-left">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mx-auto space-y-16"
      >
        {/* Header Block */}
        <div className="space-y-4 max-w-2xl">
          <motion.div variants={childVariants} className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase tracking-wider font-mono">
            MIT Licensed
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            LeadForge Open Source
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            The core LeadForge OS desktop application and local libraries are open-source. Help us build a safer outbound sales stack.
          </motion.p>
        </div>

        {/* Repositories */}
        <motion.div variants={childVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Main Monorepo */}
          <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border-subtle)] inline-block text-[var(--primary)]">
                <GithubIcon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">leadforge-os Monorepo</h3>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Contains the main desktop client (Electron + Vite + TSX), Sync Engine relays, and database schema layers.
              </p>
            </div>
            <a 
              href="https://github.com/leadforge-os/leadforge-os" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
            >
              View Repository
            </a>
          </div>

          {/* Contributing instructions */}
          <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border-subtle)] inline-block text-[var(--success)]">
                <Heart className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">How to Contribute</h3>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                We welcome pull requests for email verification scrapers, custom SQLite WAL enhancements, and brand guidelines updates.
              </p>
            </div>
            <a 
              href="/contributors"
              className="inline-flex h-9 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
            >
              See Contributors
            </a>
          </div>

        </motion.div>

      </motion.div>
    </div>
  )
}
