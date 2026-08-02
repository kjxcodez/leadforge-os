"use client"

import React from "react"
import { motion } from "motion/react"
import Link from "next/link"

export function Navbar() {
  return (
    <motion.nav 
      className="sticky top-0 z-50 flex h-16 items-center border-b border-[var(--border-subtle)] bg-[rgba(10,10,11,0.86)] backdrop-blur-md"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-[var(--foreground)] group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="relative flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--card)] shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
          >
            <img src="/app-icon-dark.png" className="h-[18px] w-[18px] object-contain transition-all duration-300 group-hover:drop-shadow-[0_0_6px_rgba(232,98,44,0.5)]" alt="Logo" />
          </motion.div>
          LeadForge OS
        </Link>
        <div className="hidden gap-8 text-xs font-medium text-[var(--muted-foreground)] md:flex">
          <Link href="/features" className="hover:text-[var(--foreground)] transition-colors duration-150">Features</Link>
          <Link href="/architecture" className="hover:text-[var(--foreground)] transition-colors duration-150">Architecture</Link>
          <Link href="/pricing" className="hover:text-[var(--foreground)] transition-colors duration-150">Pricing</Link>
          <Link href="/roadmap" className="hover:text-[var(--foreground)] transition-colors duration-150">Roadmap</Link>
          <Link href="/faq" className="hover:text-[var(--foreground)] transition-colors duration-150">FAQ</Link>
          <Link href="/docs" className="hover:text-[var(--foreground)] transition-colors duration-150">Docs</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/beta" className="inline-flex h-9 items-center justify-center px-4 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
            Beta
          </Link>
          <Link 
            href="/download" 
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[oklch(0.698_0.167_41.6)] transition-colors duration-150"
          >
            Download
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}
