"use client"

import React from "react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--background)] py-16 text-xs text-[var(--text-tertiary)]">
      <div className="container mx-auto px-6">
        
        {/* Footer Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_repeat(4,1fr)] gap-8 mb-12 select-none">
          
          {/* Brand Col */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--foreground)]">
              <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#F4F4F5" />
                <path d="M13.5 20V13.5H20L13.5 20Z" fill="#E8622C" />
              </svg>
              LeadForge OS
            </Link>
            <p className="leading-relaxed max-w-[220px]">
              A local-first desktop OS for discovering, enriching, and closing your next customer.
            </p>
          </div>

          {/* Product Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Product</h5>
            <ul className="space-y-2.5">
              <li><Link href="/features" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Features</Link></li>
              <li><Link href="/architecture" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Architecture</Link></li>
              <li><Link href="/pricing" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Pricing</Link></li>
              <li><Link href="/download" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Download</Link></li>
            </ul>
          </div>

          {/* Resources Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Resources</h5>
            <ul className="space-y-2.5">
              <li><Link href="/docs" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Documentation</Link></li>
              <li><Link href="/changelog" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Changelog</Link></li>
              <li><Link href="/releases" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Releases</Link></li>
              <li><Link href="/roadmap" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Roadmap</Link></li>
              <li><Link href="/faq" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">FAQ</Link></li>
            </ul>
          </div>

          {/* Company Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Company</h5>
            <ul className="space-y-2.5">
              <li><Link href="/about" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">About</Link></li>
              <li><Link href="/blog" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Blog</Link></li>
              <li><Link href="/contact" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Contact</Link></li>
              <li><Link href="/community" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Community</Link></li>
              <li><Link href="/beta" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Beta Program</Link></li>
            </ul>
          </div>

          {/* Legal Col */}
          <div className="space-y-4">
            <h5 className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Legal</h5>
            <ul className="space-y-2.5">
              <li><Link href="/privacy" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Privacy</Link></li>
              <li><Link href="/terms" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Terms</Link></li>
              <li><Link href="/security" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Security</Link></li>
              <li><Link href="/press" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Press Kit</Link></li>
              <li><Link href="/brand" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">Brand Assets</Link></li>
            </ul>
          </div>

        </div>

        {/* Footer Bottom */}
        <div className="border-t border-[var(--border-subtle)] pt-6 flex flex-col md:flex-row justify-between gap-4 select-none">
          <div className="flex gap-4 items-center">
            <span>© 2026 LeadForge OS. All rights reserved.</span>
            <span className="h-3 w-px bg-[var(--border-subtle)]"></span>
            <Link href="/status" className="hover:text-[var(--foreground)] flex items-center gap-1.5 transition-colors duration-150">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse"></span>
              All Systems Operational
            </Link>
          </div>
          <div className="flex gap-6 items-center">
            <Link href="/open-source" className="hover:text-[var(--foreground)] transition-colors duration-150">Open Source</Link>
            <Link href="/contributors" className="hover:text-[var(--foreground)] transition-colors duration-150">Contributors</Link>
            <Link href="/api-docs" className="hover:text-[var(--foreground)] transition-colors duration-150">API Reference</Link>
            <a href="https://github.com/leadforge-os" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors duration-150 font-mono">
              GitHub
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}
