"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Architecture() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [isOnline, setIsOnline] = useState(true)
  const [backlogCount, setBacklogCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [sqliteFlash, setSqliteFlash] = useState(false)
  const [cloudFlash, setCloudFlash] = useState(false)

  // Disconnect Cloud trigger
  const handleToggleConnection = () => {
    if (isSyncing) return // prevent toggling during active sync catch-up
    setIsOnline(!isOnline)
  }

  // Simulate Local Write trigger
  const handleLocalWrite = () => {
    setBacklogCount(prev => prev + 1)
    setSqliteFlash(true)
    setTimeout(() => setSqliteFlash(false), 300)
  }

  // Reconnect and Sync trigger
  const handleReconnectSync = () => {
    if (backlogCount === 0) {
      setIsOnline(true)
      return
    }

    setIsSyncing(true)
    setIsOnline(true)

    // Simulate backlog emptying sequentially
    const syncDuration = prefersReducedMotion ? 0 : 400 // ms per item
    
    if (prefersReducedMotion) {
      setBacklogCount(0)
      setCloudFlash(true)
      setIsSyncing(false)
      setTimeout(() => setCloudFlash(false), 300)
    } else {
      let currentBacklog = backlogCount
      const interval = setInterval(() => {
        currentBacklog -= 1
        setBacklogCount(currentBacklog)

        // Trigger a flash on Cloud API block to show data ingestion
        setCloudFlash(true)
        setTimeout(() => setCloudFlash(false), 150)

        if (currentBacklog <= 0) {
          clearInterval(interval)
          setIsSyncing(false)
        }
      }, syncDuration)
    }
  }

  return (
    <section id="architecture" className="py-24 border-t border-[var(--border-subtle)] bg-[var(--background)]">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"></span>
            Architecture
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:text-4xl">
            Local-first, not local-only
          </h2>
          <p className="text-[var(--muted-foreground)] leading-relaxed text-sm md:text-base">
            Every read and write hits a workspace-isolated SQLite database on your machine first. A sync engine pushes changes to the cloud in the background, treating the network as a transport layer — not a dependency.
          </p>
        </div>

        {/* Option C: Dynamic Architecture Diagram */}
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--card)] p-6 md:p-10 mb-12 shadow-xl">
          {/* Simulation Toolbar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6 mb-8 select-none">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[var(--foreground)]">Sync Engine Observability Panel</div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Toggle network state to simulate offline writes and background synchronization.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Connection Status Toggle */}
              <button 
                onClick={handleToggleConnection}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded text-xs font-mono border transition-all duration-150 flex items-center gap-2 ${
                  isOnline 
                    ? "bg-primary/10 text-primary border-primary/35 hover:bg-primary/20" 
                    : "bg-red-500/10 text-red-400 border-red-500/35 hover:bg-red-500/20"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-[var(--primary)]" : "bg-red-400"} ${isOnline && !isSyncing ? "animate-pulse" : ""}`}></span>
                {isOnline ? "Network: Connected" : "Network: Offline"}
              </button>

              {/* Local Write Trigger */}
              {!isOnline && (
                <button 
                  onClick={handleLocalWrite}
                  className="px-3 py-1.5 rounded text-xs font-mono border bg-[var(--background)] text-[var(--foreground)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all duration-150 flex items-center gap-1.5"
                >
                  <svg className="h-3 w-3 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Create Local Mutation
                </button>
              )}

              {/* Reconnect & Sync Trigger */}
              {!isOnline && backlogCount > 0 && (
                <button 
                  onClick={handleReconnectSync}
                  className="px-3 py-1.5 rounded text-xs font-mono border bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[oklch(0.698_0.167_41.6)] transition-all duration-150 flex items-center gap-1.5"
                >
                  Sync Backlog ({backlogCount})
                </button>
              )}
            </div>
          </div>

          {/* Interactive SVG Diagram */}
          <div className="relative overflow-x-auto">
            <svg className="min-w-[800px] w-full h-auto max-h-[260px]" viewBox="0 0 1000 260" fill="none">
              
              {/* CONNECTOR PATHS */}
              {/* Electron -> SQLite */}
              <path d="M160 130 H 310" stroke="var(--border-default)" strokeWidth="1.5"/>
              
              {/* SQLite -> Job Scheduler */}
              <path d="M470 130 H 620" stroke="var(--border-default)" strokeWidth="1.5"/>
              
              {/* Job Scheduler -> Sync Engine Connector Line */}
              <path 
                d="M780 130 H 850" 
                className="transition-all duration-300"
                stroke={isOnline ? "var(--border-default)" : "var(--border-subtle)"} 
                strokeWidth="1.5"
              />
              
              {/* Job Scheduler -> Sync Engine (top) */}
              <path 
                d="M780 96 V 40 H 850" 
                className="transition-all duration-300"
                stroke={isOnline ? "var(--border-default)" : "var(--border-subtle)"} 
                strokeWidth="1.5"
              />
              
              {/* Job Scheduler -> Cloud API (bottom) */}
              <path 
                d="M780 164 V 220 H 850" 
                className="transition-all duration-300"
                stroke={isOnline ? "var(--border-default)" : "var(--border-subtle)"} 
                strokeWidth="1.5"
              />

              {/* DYNAMIC FLOW PARTICLES / PULSES (Disabled in prefers-reduced-motion) */}
              {!prefersReducedMotion && (
                <>
                  {/* Electron -> SQLite Pulse */}
                  <circle r="3.5" fill="var(--primary)">
                    <animateMotion dur="2.5s" repeatCount="indefinite" path="M160 130 H 310" />
                  </circle>

                  {/* SQLite -> Job Scheduler Pulse */}
                  <circle r="3.5" fill="var(--primary)">
                    <animateMotion dur="3s" repeatCount="indefinite" path="M470 130 H 620" />
                  </circle>

                  {/* Online only connection pulses */}
                  {isOnline && (
                    <>
                      {/* Job Scheduler -> Sync Engine Pulse */}
                      <circle r="3.5" fill="var(--primary)">
                        <animateMotion dur="3.5s" repeatCount="indefinite" path="M780 96 V 40 H 850" />
                      </circle>
                      
                      {/* Job Scheduler -> Cloud API Pulse */}
                      <circle r="3.5" fill="rgba(244, 244, 245, 0.4)">
                        <animateMotion dur="4s" repeatCount="indefinite" path="M780 164 V 220 H 850" />
                      </circle>

                      {/* Sync Engine -> Cloud API background pulses */}
                      <circle r="3" fill="var(--primary)">
                        <animateMotion dur="5s" repeatCount="indefinite" path="M 915 80 V 190" />
                      </circle>
                    </>
                  )}

                  {/* Sync Catch-up Fast Pulses */}
                  {isSyncing && (
                    <circle r="4" fill="var(--primary)">
                      <animateMotion dur="0.5s" repeatCount="indefinite" path="M780 96 V 40 H 850" />
                    </circle>
                  )}
                </>
              )}

              {/* DIAGRAM BLOCKS */}
              {/* Electron Shell */}
              <g>
                <rect x="20" y="70" width="140" height="120" rx="12" fill="var(--card)" stroke="var(--border-default)"/>
                <text x="90" y="102" textAnchor="middle" fill="var(--foreground)" fontFamily="Inter" fontSize="13" fontWeight="600">Electron</text>
                <text x="90" y="120" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="JetBrains Mono" fontSize="9">Renderer + Main</text>
                <text x="90" y="142" textAnchor="middle" fill="var(--muted-foreground)" fontFamily="Inter" fontSize="11">Desktop shell</text>
                <text x="90" y="158" textAnchor="middle" fill="var(--muted-foreground)" fontFamily="Inter" fontSize="11">runs on machine</text>
              </g>

              {/* Local SQLite */}
              <g>
                <motion.rect 
                  x="310" y="70" width="160" height="120" rx="12" 
                  fill="var(--card)" 
                  stroke={sqliteFlash ? "var(--success)" : "var(--primary)"}
                  strokeOpacity={sqliteFlash ? 0.9 : 0.4}
                  animate={sqliteFlash ? { scale: 1.02 } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                />
                <text x="390" y="102" textAnchor="middle" fill="var(--foreground)" fontFamily="Inter" fontSize="13" fontWeight="600">Local SQLite</text>
                <text x="390" y="120" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="JetBrains Mono" fontSize="9">WAL mode</text>
                <text x="390" y="142" textAnchor="middle" fill="var(--muted-foreground)" fontFamily="Inter" fontSize="11">Source of truth</text>
                <motion.text 
                  x="390" y="158" textAnchor="middle" 
                  fill={backlogCount > 0 ? "var(--warning)" : "var(--primary)"} 
                  fontFamily="Inter" fontSize="11"
                >
                  {backlogCount > 0 ? `Backlog: ${backlogCount} mutations` : "workspace-isolated"}
                </motion.text>
              </g>

              {/* Job Scheduler */}
              <g>
                <rect x="620" y="70" width="160" height="120" rx="12" fill="var(--card)" stroke="var(--border-default)"/>
                <text x="700" y="102" textAnchor="middle" fill="var(--foreground)" fontFamily="Inter" fontSize="13" fontWeight="600">Job Scheduler</text>
                <text x="700" y="120" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="JetBrains Mono" fontSize="9">sandboxed workers</text>
                <text x="700" y="142" textAnchor="middle" fill="var(--muted-foreground)" fontFamily="Inter" fontSize="11">Scraper · Crawler</text>
                <text x="700" y="158" textAnchor="middle" fill="var(--muted-foreground)" fontFamily="Inter" fontSize="11">Enricher · Outreach</text>
              </g>

              {/* Sync Engine */}
              <g>
                <motion.rect 
                  x="850" y="10" width="130" height="70" rx="10" 
                  fill="var(--card)" 
                  stroke={isOnline ? "var(--border-default)" : "var(--border-subtle)"}
                  animate={isSyncing ? { stroke: ["var(--border-default)", "var(--primary)", "var(--border-default)"] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
                <text x="915" y="42" textAnchor="middle" fill={isOnline ? "var(--foreground)" : "var(--text-tertiary)"} fontFamily="Inter" fontSize="12" fontWeight="600">Sync Engine</text>
                <text x="915" y="58" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="JetBrains Mono" fontSize="9">
                  {isSyncing ? "Syncing backlog..." : isOnline ? "background push" : "paused (offline)"}
                </text>
              </g>

              {/* Cloud API */}
              <g>
                <motion.rect 
                  x="850" y="190" width="130" height="70" rx="10" 
                  fill="var(--card)" 
                  stroke={cloudFlash ? "var(--success)" : isOnline ? "var(--border-default)" : "var(--border-subtle)"}
                  strokeOpacity={cloudFlash ? 0.9 : 1}
                  animate={cloudFlash ? { scale: 1.03 } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                />
                <text x="915" y="222" textAnchor="middle" fill={isOnline ? "var(--foreground)" : "var(--text-tertiary)"} fontFamily="Inter" fontSize="12" fontWeight="600">Cloud API</text>
                <text x="915" y="238" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="JetBrains Mono" fontSize="9">team backup, not truth</text>
              </g>

            </svg>
          </div>
        </div>

        {/* Compare / Why local-first cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LeadForge Card */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="rounded-xl border border-primary/20 bg-[var(--card)] p-6 md:p-8 hover:border-primary/45 transition-colors duration-200"
          >
            <h4 className="font-mono text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-6">
              LeadForge OS
            </h4>
            <div className="divide-y divide-[var(--border-subtle)] text-sm select-none">
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Where scraping runs</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Your desktop</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Where lead data lives</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Local SQLite first</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Offline behavior</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Fully usable</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Credential storage</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">OS keychain, encrypted</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Pricing model</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Own your infrastructure</span>
              </div>
            </div>
          </motion.div>

          {/* Cloud CRM Card */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.35, delay: prefersReducedMotion ? 0 : 0.12, ease: "easeOut" }}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-6 md:p-8"
          >
            <h4 className="font-mono text-xs font-semibold text-red-400 uppercase tracking-wider mb-6">
              Typical cloud outbound tools
            </h4>
            <div className="divide-y divide-[var(--border-subtle)] text-sm select-none">
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Where scraping runs</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Vendor's servers</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Where lead data lives</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Vendor's database</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Offline behavior</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Requires connection</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Credential storage</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Uploaded to vendor</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-[var(--muted-foreground)]">Pricing model</span>
                <span className="text-[var(--foreground)] font-medium font-mono text-xs">Per-seat, usage-metered</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  )
}
