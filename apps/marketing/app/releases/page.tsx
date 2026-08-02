"use client"

import React from "react"
import { motion } from "motion/react"
import { ArrowDownToLine, Monitor, Apple, Terminal, Database, Check } from "lucide-react"

export default function ReleasesPage() {
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

  const releases = [
    {
      version: "v1.4.2",
      date: "August 2, 2026",
      status: "Stable",
      commit: "a8e932b",
      assets: [
        { name: "LeadForge-Setup-1.4.2.exe", size: "82.4 MB", type: "win", link: "https://github.com/leadforge-os/releases/download/v1.4.2/LeadForge-Setup-1.4.2.exe" },
        { name: "LeadForge-Mac-1.4.2.dmg", size: "78.1 MB", type: "mac", disabled: true },
        { name: "LeadForge-Linux-1.4.2.AppImage", size: "91.3 MB", type: "linux", disabled: true }
      ]
    },
    {
      version: "v1.4.0",
      date: "July 24, 2026",
      status: "Deprecated",
      commit: "542ebc9",
      assets: [
        { name: "LeadForge-Setup-1.4.0.exe", size: "81.9 MB", type: "win", link: "https://github.com/leadforge-os/releases/download/v1.4.0/LeadForge-Setup-1.4.0.exe" }
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
            Release Distribution
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            Releases Repository
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            Archive of stable and previous builds of LeadForge OS. Verify assets using commit signatures.
          </motion.p>
        </div>

        {/* Releases Timeline */}
        <motion.div variants={childVariants} className="space-y-8">
          {releases.map((rel) => (
            <div key={rel.version} className="border border-[var(--border)] rounded-lg p-5 bg-[var(--card)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-[var(--foreground)] font-mono">{rel.version}</h3>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    rel.status === "Stable" 
                      ? "bg-[rgba(63,178,127,0.12)] text-[#3FB27F] border-[rgba(63,178,127,0.2)]" 
                      : "bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border-subtle)]"
                  }`}>
                    {rel.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-tertiary)]">
                  <span>Commit {rel.commit}</span>
                  <span>Released {rel.date}</span>
                </div>
              </div>

              {/* Assets list */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-tertiary)] mb-2 font-semibold">Assets</div>
                <div className="space-y-2">
                  {rel.assets.map((asset) => {
                    const IconComp = asset.type === "win" ? Monitor : asset.type === "mac" ? Apple : Terminal
                    return (
                      <div key={asset.name} className="flex items-center justify-between text-xs bg-[var(--background)] border border-[var(--border-subtle)] rounded p-2.5">
                        <div className="flex items-center gap-2">
                          <IconComp className="h-4 w-4 text-[var(--text-secondary)]" />
                          <span className="font-mono text-[11px] text-[var(--foreground)] truncate max-w-[240px] md:max-w-md">
                            {asset.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">({asset.size})</span>
                        </div>
                        {asset.disabled ? (
                          <span className="text-[9px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider mr-2">Beta In Progress</span>
                        ) : (
                          <a 
                            href={asset.link}
                            className="inline-flex h-7 items-center justify-center rounded bg-[var(--primary)] px-3 text-[10px] font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-all gap-1 cursor-pointer"
                          >
                            <ArrowDownToLine className="h-3 w-3" />
                            Download
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

      </motion.div>
    </div>
  )
}
