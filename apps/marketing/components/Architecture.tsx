"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { Server, Database, Activity, Wifi, WifiOff, RefreshCw, Plus, Cpu, HardDrive } from "lucide-react"

export function Architecture() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [isOnline, setIsOnline] = useState(true)
  const [backlogCount, setBacklogCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [sqliteFlash, setSqliteFlash] = useState(false)
  const [cloudFlash, setCloudFlash] = useState(false)
  const [localLogs, setLocalLogs] = useState<string[]>([
    "SQLite schema local WAL initialized.",
    "Sync status: In sync."
  ])

  // Disconnect Cloud trigger
  const handleToggleConnection = () => {
    if (isSyncing) return
    setIsOnline(!isOnline)
    setLocalLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Network state: ${!isOnline ? "ONLINE" : "OFFLINE"}`,
      ...prev.slice(0, 3)
    ])
  }

  // Simulate Local Write trigger
  const handleLocalWrite = () => {
    setBacklogCount(prev => prev + 1)
    setSqliteFlash(true)
    setLocalLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Local write committed to SQLite: id_${Math.floor(Math.random() * 1000)}`,
      ...prev.slice(0, 3)
    ])
    setTimeout(() => setSqliteFlash(false), 200)
  }

  // Reconnect and Sync trigger
  const handleReconnectSync = () => {
    if (backlogCount === 0) {
      setIsOnline(true)
      return
    }

    setIsSyncing(true)
    setIsOnline(true)
    setLocalLogs(prev => [
      `[${new Date().toLocaleTimeString()}] Background sync queue dispatching ${backlogCount} mutations...`,
      ...prev.slice(0, 3)
    ])

    const syncDuration = prefersReducedMotion ? 0 : 300 // ms per item
    
    if (prefersReducedMotion) {
      setBacklogCount(0)
      setCloudFlash(true)
      setIsSyncing(false)
      setTimeout(() => setCloudFlash(false), 200)
    } else {
      let currentBacklog = backlogCount
      const interval = setInterval(() => {
        currentBacklog -= 1
        setBacklogCount(currentBacklog)
        setCloudFlash(true)
        setTimeout(() => setCloudFlash(false), 120)

        if (currentBacklog <= 0) {
          clearInterval(interval)
          setIsSyncing(false)
          setLocalLogs(prev => [
            `[${new Date().toLocaleTimeString()}] SQLite workspace fully synced. Backlog: 0`,
            ...prev.slice(0, 3)
          ])
        }
      }, syncDuration)
    }
  }

  return (
    <section id="architecture" className="py-24 border-t border-[var(--border-subtle)] bg-[#070708] relative overflow-hidden lg:px-32 md:px-20 px-4">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16 text-left">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            <Activity className="h-3.5 w-3.5 text-[var(--primary)]" />
            System Architecture
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4 md:text-4xl">
            Local-first. Sync in the background.
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed text-xs sm:text-sm">
            Outreach mutations target your local workspace database first. A separate sync manager processes mutations in background batches, keeping records healthy even during network interruptions.
          </p>
        </div>

        {/* Sync Observability Sandbox Panel */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(10,10,12,0.55)] backdrop-blur p-6 md:p-8 shadow-xl max-w-4xl mx-auto fresnel-highlight">
          
          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 mb-8 select-none font-mono text-xs">
            <div className="text-left">
              <h3 className="font-bold text-white leading-tight">Sync Engine Observability</h3>
              <p className="text-[9.5px] text-[var(--text-tertiary)] mt-0.5">Toggle connectivity state to audit offline pipelines.</p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Online/Offline Toggle */}
              <button 
                onClick={handleToggleConnection}
                disabled={isSyncing}
                className={`h-8 px-3.5 rounded text-[10px] font-bold tracking-wider uppercase border transition-all cursor-pointer flex items-center gap-2 ${
                  isOnline 
                    ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/15" 
                    : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/15"
                }`}
              >
                {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {isOnline ? "Connected" : "Offline Mode"}
              </button>

              {/* Local Mutation Insert */}
              {!isOnline && (
                <button 
                  onClick={handleLocalWrite}
                  className="h-8 px-3.5 rounded text-[10px] font-bold tracking-wider uppercase border bg-[var(--background)] text-white border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--primary)]" />
                  Local Mutate
                </button>
              )}

              {/* Sync Backlog Trigger */}
              {!isOnline && backlogCount > 0 && (
                <button 
                  onClick={handleReconnectSync}
                  className="h-8 px-3.5 rounded text-[10px] font-bold tracking-wider uppercase border bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sync Backlog ({backlogCount})
                </button>
              )}
            </div>
          </div>

          {/* Fully Responsive HTML Schematic Node grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 select-none font-mono text-left relative">
            
            {/* 1. Electron Interface */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[rgba(9,9,10,0.8)] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold mb-3">
                  <HardDrive className="h-3.5 w-3.5 text-[var(--primary)]" />
                  01 · UI Shell
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">Electron Renderer</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  Local client interface and local session caching state.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-tertiary)]">
                State: Active
              </div>
            </div>

            {/* 2. SQLite Database */}
            <motion.div 
              animate={sqliteFlash ? { scale: 1.02 } : { scale: 1 }}
              transition={{ duration: 0.15 }}
              className={`rounded-lg border bg-[rgba(9,9,10,0.8)] p-4 flex flex-col justify-between transition-colors ${
                sqliteFlash ? "border-primary" : "border-[var(--border-subtle)]"
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold mb-3">
                  <Database className="h-3.5 w-3.5 text-[var(--primary)]" />
                  02 · Storage
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">SQLite database</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  Workspace isolated WAL file. Local single source of truth.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-tertiary)] flex items-center justify-between">
                <span>Backlog queue:</span>
                <span className={`font-bold ${backlogCount > 0 ? "text-amber-400" : "text-green-400"}`}>
                  {backlogCount} muts
                </span>
              </div>
            </motion.div>

            {/* 3. Local Job Scheduler & Sync Manager */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[rgba(9,9,10,0.8)] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold mb-3">
                  <Cpu className="h-3.5 w-3.5 text-[var(--primary)]" />
                  03 · Controller
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">Sync Manager</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  Monitors SQLite WAL writes and schedules background sync loops.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-tertiary)] flex items-center justify-between">
                <span>Loop status:</span>
                <span className={isSyncing ? "text-primary animate-pulse" : "text-[var(--text-secondary)]"}>
                  {isSyncing ? "Syncing..." : "Waiting"}
                </span>
              </div>
            </div>

            {/* 4. Remote Cloud API Endpoint */}
            <motion.div 
              animate={cloudFlash ? { scale: 1.02 } : { scale: 1 }}
              transition={{ duration: 0.15 }}
              className={`rounded-lg border bg-[rgba(9,9,10,0.8)] p-4 flex flex-col justify-between transition-colors relative ${
                cloudFlash ? "border-green-500/50" : "border-[var(--border-subtle)]"
              }`}
            >
              <span className="absolute top-2 right-2 px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-[7px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                Planned
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-bold mb-3">
                  <Server className="h-3.5 w-3.5 text-[var(--primary)]" />
                  04 · Network
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">Cloud API Hub</h4>
                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                  Backup layer, team synchronization, and outbound relays.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] text-[9px] text-[var(--text-tertiary)] flex items-center justify-between">
                <span>Link state:</span>
                <span className={isOnline ? "text-green-400" : "text-red-400"}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
            </motion.div>

          </div>

          {/* SQLite WAL Terminal outputs */}
          <div className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-[rgba(8,8,9,0.9)] p-4 font-mono text-[9px] text-[var(--text-secondary)] text-left select-none">
            <div className="border-b border-[var(--border-subtle)] pb-2 mb-2 uppercase text-[7.5px] font-bold text-[var(--text-tertiary)]">
              Local synchronization activity logs
            </div>
            <div className="space-y-1">
              {localLogs.map((log, idx) => (
                <div key={idx} className="truncate">
                  <span className="text-[var(--text-tertiary)] mr-2">&gt;</span>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
