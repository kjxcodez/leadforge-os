"use client"

import React, { useState } from "react"
import { Info, AlertTriangle, CheckCircle, Flame, Check, Copy } from "lucide-react"

// ---------------------------------------------------------------------------
// Callout & Alerts
// ---------------------------------------------------------------------------

interface CalloutProps {
  type?: "info" | "warning" | "tip" | "danger"
  title?: string
  children: React.ReactNode
}

export function Callout({ type = "info", title, children }: CalloutProps) {
  let borderClass = "border-blue-500/30 bg-blue-500/5 text-blue-400"
  let titleText = title || "Info"
  let Icon = Info

  if (type === "warning") {
    borderClass = "border-amber-500/30 bg-amber-500/5 text-amber-400"
    titleText = title || "Warning"
    Icon = AlertTriangle
  } else if (type === "tip") {
    borderClass = "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
    titleText = title || "Tip"
    Icon = CheckCircle
  } else if (type === "danger") {
    borderClass = "border-red-500/30 bg-red-500/5 text-red-400"
    titleText = title || "Danger"
    Icon = Flame
  }

  return (
    <div className={`my-6 flex gap-3 border-l-2 p-4 rounded-r-lg text-xs leading-relaxed ${borderClass}`}>
      <Icon className="h-4.5 w-4.5 shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold uppercase tracking-wider text-[10px] mb-1.5">{titleText}</div>
        <div className="text-[var(--text-secondary)]">{children}</div>
      </div>
    </div>
  )
}

export function Note({ children }: { children: React.ReactNode }) {
  return <Callout type="info" title="Note">{children}</Callout>
}

export function Warning({ children }: { children: React.ReactNode }) {
  return <Callout type="warning" title="Warning">{children}</Callout>
}

export function Tip({ children }: { children: React.ReactNode }) {
  return <Callout type="tip" title="Tip">{children}</Callout>
}

// ---------------------------------------------------------------------------
// Tabs & Tab panels
// ---------------------------------------------------------------------------

interface TabsProps {
  children: React.ReactNode
}

export function Tabs({ children }: TabsProps) {
  const tabs = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && (child.props as any)?.label
  ) as React.ReactElement[]

  const [activeTabIdx, setActiveTabIdx] = useState(0)

  if (tabs.length === 0) return null

  return (
    <div className="my-6 border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[rgba(10,10,11,0.2)]">
      {/* Tab Headers */}
      <div className="flex border-b border-[var(--border-subtle)] bg-[var(--card)] px-2">
        {tabs.map((tab, idx) => {
          const isActive = idx === activeTabIdx
          return (
            <button
              key={idx}
              onClick={() => setActiveTabIdx(idx)}
              className={`h-9 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                isActive 
                  ? "border-[var(--primary)] text-[var(--foreground)]" 
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {(tab.props as any).label}
            </button>
          )
        })}
      </div>
      {/* Active Tab Panel */}
      <div className="p-5 text-xs text-[var(--text-secondary)]">
        {tabs[activeTabIdx]}
      </div>
    </div>
  )
}

interface TabProps {
  label: string
  children: React.ReactNode
}

export function Tab({ children }: TabProps) {
  return <div>{children}</div>
}

// ---------------------------------------------------------------------------
// Steps Timeline
// ---------------------------------------------------------------------------

export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 pl-6 border-l border-[var(--border-subtle)] space-y-6 relative">
      {children}
    </div>
  )
}

export function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {/* Node Bullet */}
      <span className="absolute -left-[30px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--background)] border border-[var(--border-strong)] text-[8px] font-mono text-[var(--primary)] group-hover:border-[var(--primary)] transition-colors">
        •
      </span>
      <h3 className="text-xs font-semibold text-[var(--foreground)] mb-1">{title}</h3>
      <div className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "outline" }) {
  let styleClass = "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border-subtle)]"
  if (variant === "success") {
    styleClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
  } else if (variant === "warning") {
    styleClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20"
  } else if (variant === "outline") {
    styleClass = "border border-[var(--primary)] text-[var(--primary)]"
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider font-semibold select-none ${styleClass}`}>
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// VersionBadge
// ---------------------------------------------------------------------------

export function VersionBadge({ version, status = "Stable" }: { version: string; status?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border-subtle)] text-[10px] font-mono">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
      <span className="text-[var(--foreground)] font-semibold">{version}</span>
      <span className="text-[var(--text-tertiary)]">({status})</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardGrid & cards
// ---------------------------------------------------------------------------

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">{children}</div>
}

export function Card({ title, description, href }: { title: string; description: string; href?: string }) {
  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (href) {
      return (
        <a href={href} className="border border-[var(--border-subtle)] rounded-lg p-4 bg-[var(--card)] hover:border-[var(--primary)] transition-all block text-left group">
          {children}
        </a>
      )
    }
    return (
      <div className="border border-[var(--border-subtle)] rounded-lg p-4 bg-[var(--card)] text-left">
        {children}
      </div>
    )
  }

  return (
    <CardWrapper>
      <h4 className="text-xs font-semibold text-[var(--foreground)] mb-1 group-hover:text-[var(--primary)] transition-colors">{title}</h4>
      <p className="text-[11px] text-[var(--text-secondary)] leading-normal m-0">{description}</p>
    </CardWrapper>
  )
}

// ---------------------------------------------------------------------------
// Terminal command window
// ---------------------------------------------------------------------------

export function TerminalWindow({ children, command }: { children?: React.ReactNode; command?: string }) {
  const [copied, setCopied] = useState(false)
  const codeText = command || ""

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="my-6 border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[rgba(10,10,11,0.6)] font-mono text-[11px] leading-relaxed">
      <div className="flex h-8 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--card)] px-4 select-none">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
          <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
        </div>
        <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">terminal</span>
        <button 
          onClick={handleCopy}
          className="text-[9px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[var(--muted-foreground)] whitespace-pre-wrap select-all">
        {command ? <span className="text-[var(--primary)] select-none">$ </span> : null}
        {command || children}
      </div>
    </div>
  )
}
