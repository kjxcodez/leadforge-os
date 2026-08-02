"use client"

import React from "react"
import { motion } from "motion/react"
import { Users, Heart } from "lucide-react"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export default function ContributorsPage() {
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

  const contributors = [
    { name: "Greentech Modelers", role: "Core maintainer", initial: "GM", commits: 218 },
    { name: "Austin Dev Team", role: "SMTP Engine lead", initial: "AD", commits: 84 },
    { name: "Local First Core", role: "SQLite WAL architect", initial: "LF", commits: 45 }
  ]

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
            Active Maintainers
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            LeadForge Contributors
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            Meet the developers and technical operators who maintain the local-first libraries and Electron build packages.
          </motion.p>
        </div>

        {/* Contributors grid */}
        <motion.div variants={childVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contributors.map((contrib) => (
            <div key={contrib.name} className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] flex items-center gap-4 hover:border-[var(--border-strong)] transition-all">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--primary)] text-xs font-bold text-[var(--primary-foreground)] select-none font-mono">
                {contrib.initial}
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-xs font-semibold text-[var(--foreground)]">{contrib.name}</div>
                <div className="truncate text-[10px] text-[var(--text-tertiary)]">{contrib.role}</div>
                <div className="text-[9px] font-mono text-[var(--primary)] mt-0.5">{contrib.commits} commits</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Call to action */}
        <motion.div variants={childVariants} className="border border-[var(--border)] rounded-lg p-6 bg-[var(--card)] text-center space-y-4 max-w-xl mx-auto">
          <Heart className="h-8 w-8 text-[var(--primary)] mx-auto animate-pulse" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Want to contribute?</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              We welcome code pull requests for SMTP handshake fixes, WAL checkpoints, or UX adjustments. Join us on GitHub.
            </p>
          </div>
          <a 
            href="https://github.com/leadforge-os/leadforge-os" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center rounded bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-all cursor-pointer"
          >
            Submit a Pull Request
          </a>
        </motion.div>

      </motion.div>
    </div>
  )
}
