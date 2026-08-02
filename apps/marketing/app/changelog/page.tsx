"use client"

import React from "react"
import { motion } from "motion/react"
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"

export default function ChangelogPage() {
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

  const logs = [
    {
      date: "August 2, 2026",
      version: "v1.4.2",
      badgeStyle: "bg-[rgba(63,178,127,0.12)] text-[#3FB27F] border-[rgba(63,178,127,0.2)]",
      changes: [
        { type: "Added", text: "Interactive CRM & Intelligence tab switching inside details drawer.", icon: Sparkles, iconColor: "text-[var(--primary)]" },
        { type: "Fixed", text: "Optimized border custom variables in dark mode to soften visual contrast.", icon: CheckCircle2, iconColor: "text-[var(--success)]" },
        { type: "Changed", text: "Swapped near-white Add Company buttons for primary colored elements.", icon: Sparkles, iconColor: "text-[var(--primary)]" }
      ]
    },
    {
      date: "July 24, 2026",
      version: "v1.4.0",
      badgeStyle: "bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border-subtle)]",
      changes: [
        { type: "Added", text: "Local operation scraper logs strip streaming directly into SQLite databases.", icon: Sparkles, iconColor: "text-[var(--primary)]" },
        { type: "Fixed", text: "Corrected prefers-reduced-motion triggers on particle canvas node grid interpolations.", icon: CheckCircle2, iconColor: "text-[var(--success)]" }
      ]
    }
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
            Changelog Logs
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            Latest Updates
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            Dated logs of added, changed, and fixed items inside LeadForge OS release timelines.
          </motion.p>
        </div>

        {/* Changelog Timeline */}
        <motion.div variants={childVariants} className="space-y-12">
          {logs.map((log) => (
            <div key={log.version} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 border-t border-[var(--border-subtle)] pt-8">
              
              {/* Date & Version */}
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-tertiary)] font-mono">{log.date}</div>
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[10px] font-mono font-medium border ${log.badgeStyle}`}>
                  {log.version}
                </span>
              </div>

              {/* Changes List */}
              <div className="space-y-4">
                {log.changes.map((change, idx) => {
                  const IconComp = change.icon
                  return (
                    <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-[var(--text-secondary)] bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                      <div className={`p-1.5 rounded bg-[var(--background)] border border-[var(--border-subtle)] mt-0.5 shrink-0 ${change.iconColor}`}>
                        <IconComp className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-1 mt-0.5">
                        <span className="font-semibold text-[var(--foreground)] mr-1.5">[{change.type}]</span>
                        {change.text}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          ))}
        </motion.div>

      </motion.div>
    </div>
  )
}
