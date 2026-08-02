"use client"

import React from "react"
import { motion } from "motion/react"
import { Image, FileText, Download } from "lucide-react"

export default function PressPage() {
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
            Press Kit
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            LeadForge Press Kit
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            Resources for publications writing about local-first systems, secure SMTP outreach, or SQLite WAL concurrency solutions.
          </motion.p>
        </div>

        {/* Media Assets */}
        <motion.div variants={childVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Logo package */}
          <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border-subtle)] inline-block text-[var(--primary)]">
                <Image className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Brand Logo Package</h3>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Contains SVG vector formats of the LeadForge logo (light, dark, monochrome) for media prints.
              </p>
            </div>
            <a 
              href="/brand" 
              className="inline-flex h-9 items-center justify-center rounded border border-[var(--border)] bg-[var(--background)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
            >
              Get Logo Assets
            </a>
          </div>

          {/* Boilerplate text */}
          <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-2 rounded bg-[var(--background)] border border-[var(--border-subtle)] inline-block text-[var(--primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Product Boilerplate</h3>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Summary details of the product architecture, developer guidelines, and company vision boilerplate.
              </p>
            </div>
            <div className="bg-[var(--background)] border border-[var(--border-subtle)] p-3 rounded text-[10px] text-[var(--text-secondary)] leading-relaxed font-mono">
              &ldquo;LeadForge OS is a local-first desktop operating system for sales discovery and direct SMTP outreach, storing all records securely inside SQLite.&rdquo;
            </div>
          </div>

        </motion.div>

      </motion.div>
    </div>
  )
}
