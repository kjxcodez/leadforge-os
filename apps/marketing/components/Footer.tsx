"use client"

import React from "react"

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--background)] py-16 text-xs text-[var(--text-tertiary)]">
      <div className="container mx-auto px-6">
        
        {/* Footer Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_repeat(4,1fr)] gap-8 mb-12 select-none">
          
          {/* Brand Col */}
          <div className="space-y-4">
            <a href="#" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">
              <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#F4F4F5" />
                <path d="M13.5 20V13.5H20L13.5 20Z" fill="#E8622C" />
              </svg>
              LeadForge OS
            </a>
            <p className="leading-relaxed max-w-[220px]">
              A local-first desktop OS for discovering, enriching, and closing your next customer.
            </p>
          </div>

          {/* Product Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Product</h5>
            <ul className="space-y-2.5">
              <li><a href="#philosophy" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Discovery</a></li>
              <li><a href="#philosophy" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Campaigns</a></li>
              <li><a href="#architecture" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Architecture</a></li>
              <li><a href="#downloads" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Download</a></li>
            </ul>
          </div>

          {/* Resources Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Resources</h5>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Documentation</a></li>
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Changelog</a></li>
              <li><a href="#roadmap" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Roadmap</a></li>
              <li><a href="#faq" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">FAQ</a></li>
            </ul>
          </div>

          {/* Company Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Company</h5>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">About</a></li>
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Blog</a></li>
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Contact</a></li>
            </ul>
          </div>

          {/* Legal Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Legal</h5>
            <ul className="space-y-2.5">
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Privacy</a></li>
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Terms</a></li>
              <li><a href="#" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Security</a></li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="border-t border-[var(--border-subtle)] pt-6 flex flex-col md:flex-row justify-between gap-4">
          <span>© 2026 LeadForge OS. All rights reserved.</span>
          <span>Built local-first.</span>
        </div>

      </div>
    </footer>
  )
}
