"use client"

import React from "react"
import { motion } from "motion/react"

export function Navbar() {
  return (
    <motion.nav 
      className="sticky top-0 z-50 flex h-16 items-center border-b border-[var(--border-subtle)] bg-[rgba(10,10,11,0.86)] backdrop-blur-md"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">
          <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none">
            <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#F4F4F5" />
            <path d="M13.5 20V13.5H20L13.5 20Z" fill="#E8622C" />
          </svg>
          LeadForge OS
        </a>
        <div className="hidden gap-8 text-xs font-medium text-[var(--muted-foreground)] md:flex">
          <a href="#philosophy" className="hover:text-[var(--foreground)] transition-colors duration-150">Product</a>
          <a href="#architecture" className="hover:text-[var(--foreground)] transition-colors duration-150">Architecture</a>
          <a href="#roadmap" className="hover:text-[var(--foreground)] transition-colors duration-150">Roadmap</a>
          <a href="#faq" className="hover:text-[var(--foreground)] transition-colors duration-150">FAQ</a>
          <a href="#" className="hover:text-[var(--foreground)] transition-colors duration-150">Docs</a>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="inline-flex h-9 items-center justify-center px-4 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
            Sign in
          </a>
          <a 
            href="#downloads" 
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[oklch(0.698_0.167_41.6)] transition-colors duration-150"
          >
            Download
          </a>
        </div>
      </div>
    </motion.nav>
  )
}
