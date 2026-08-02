"use client"

import React from "react"
import { motion } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Downloads() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <section id="downloads" className="py-24 border-t border-[var(--border-subtle)] bg-[var(--background)]">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"></span>
            Downloads
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:text-4xl">
            Get LeadForge OS
          </h2>
          <p className="text-[var(--muted-foreground)] leading-relaxed text-sm md:text-base">
            Signed releases, checksum-verified on every update.
          </p>
        </div>

        {/* Download Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Windows (Active platform) */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-primary/20 bg-[var(--card)] p-8 text-center hover:border-primary/45 transition-colors duration-200"
          >
            <div>
              <svg className="h-8 w-8 mx-auto mb-6 text-[var(--foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M8 21h8M12 18v3" />
              </svg>
              <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">Windows</h4>
              <div className="font-mono text-xs text-[var(--muted-foreground)] mb-6">v1.4.2 · x64</div>
            </div>
            
            <div>
              <a 
                href="#" 
                className="inline-flex w-full h-9 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] hover:bg-[oklch(0.698_0.167_41.6)] transition-colors duration-150"
              >
                Download for Windows
              </a>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-3">Silent, checksum-verified installer</p>
            </div>
          </motion.div>

          {/* macOS (In Progress) */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.1, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-8 text-center opacity-65 relative overflow-hidden"
          >
            {/* Status Pulse Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-warning/10 border border-warning/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)] animate-pulse"></span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--warning)]">Building</span>
            </div>

            <div>
              <svg className="h-8 w-8 mx-auto mb-6 text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3l7 4v10l-7 4-7-4V7z" />
              </svg>
              <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">macOS</h4>
              <div className="font-mono text-xs text-[var(--text-tertiary)] mb-6">Apple Silicon &amp; Intel</div>
            </div>

            <div>
              <button 
                disabled 
                className="inline-flex w-full h-9 items-center justify-center rounded-md bg-[var(--secondary)] border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--muted-foreground)] cursor-not-allowed"
              >
                Notify me
              </button>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-3">Native .dmg build in progress</p>
            </div>
          </motion.div>

          {/* Linux (In Progress) */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-8 text-center opacity-65 relative overflow-hidden"
          >
            {/* Status Pulse Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-warning/10 border border-warning/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)] animate-pulse"></span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--warning)]">Building</span>
            </div>

            <div>
              <svg className="h-8 w-8 mx-auto mb-6 text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="M4 9h16" />
              </svg>
              <h4 className="text-base font-semibold text-[var(--foreground)] mb-1">Linux</h4>
              <div className="font-mono text-xs text-[var(--text-tertiary)] mb-6">AppImage · x64</div>
            </div>

            <div>
              <button 
                disabled 
                className="inline-flex w-full h-9 items-center justify-center rounded-md bg-[var(--secondary)] border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--muted-foreground)] cursor-not-allowed"
              >
                Notify me
              </button>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-3">.AppImage build in progress</p>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  )
}
