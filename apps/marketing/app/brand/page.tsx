"use client"

import React from "react"
import { motion } from "motion/react"
import { ShieldCheck, Info } from "lucide-react"

export default function BrandPage() {
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
            Identity guidelines
          </motion.div>
          <motion.h1 variants={childVariants} className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            Brand Guidelines
          </motion.h1>
          <motion.p variants={childVariants} className="text-base text-[var(--text-secondary)] leading-relaxed">
            Assets and typography parameters defining the LeadForge OS visual brand.
          </motion.p>
        </div>

        {/* Logo Marks Block */}
        <motion.div variants={childVariants} className="border border-[var(--border)] rounded-lg p-6 bg-[var(--card)] space-y-6">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Logo Mark Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary Orange */}
            <div className="flex flex-col items-center justify-center p-8 bg-[var(--background)] border border-[var(--border-subtle)] rounded-lg space-y-4">
              <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#F4F4F5" />
                <path d="M13.5 20V13.5H20L13.5 20Z" fill="#E8622C" />
              </svg>
              <div className="text-center font-mono text-[10px] text-[var(--text-secondary)]">Forge Orange / Slate</div>
            </div>

            {/* Light Mode Alt */}
            <div className="flex flex-col items-center justify-center p-8 bg-white border border-[var(--border-subtle)] rounded-lg space-y-4">
              <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#151517" />
                <path d="M13.5 20V13.5H20L13.5 20Z" fill="#D6551F" />
              </svg>
              <div className="text-center font-mono text-[10px] text-gray-500">Light Mode Alt</div>
            </div>

            {/* Monochrome */}
            <div className="flex flex-col items-center justify-center p-8 bg-[var(--background)] border border-[var(--border-subtle)] rounded-lg space-y-4">
              <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4H20V13.5L13.5 20H4V4Z" fill="#F4F4F5" />
                <path d="M13.5 20V13.5H20L13.5 20Z" fill="#6E6E76" />
              </svg>
              <div className="text-center font-mono text-[10px] text-[var(--text-secondary)]">Monochrome Grey</div>
            </div>
          </div>
        </motion.div>

        {/* Color Palette Specifications */}
        <motion.div variants={childVariants} className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Primary Palette Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Forge Orange */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
              <div className="h-16 bg-[#E8622C]" />
              <div className="p-3 text-left">
                <div className="font-semibold text-xs text-[var(--foreground)]">Forge Orange</div>
                <div className="font-mono text-[9px] text-[var(--text-tertiary)] mt-0.5">#E8622C</div>
              </div>
            </div>

            {/* Base Background */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
              <div className="h-16 bg-[#0A0A0B]" />
              <div className="p-3 text-left">
                <div className="font-semibold text-xs text-[var(--foreground)]">Base Background</div>
                <div className="font-mono text-[9px] text-[var(--text-tertiary)] mt-0.5">#0A0A0B</div>
              </div>
            </div>

            {/* Card Surface */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
              <div className="h-16 bg-[#131316]" />
              <div className="p-3 text-left">
                <div className="font-semibold text-xs text-[var(--foreground)]">Surface Card</div>
                <div className="font-mono text-[9px] text-[var(--text-tertiary)] mt-0.5">#131316</div>
              </div>
            </div>

            {/* Primary Text */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)]">
              <div className="h-16 bg-[#F4F4F5]" />
              <div className="p-3 text-left">
                <div className="font-semibold text-xs text-[var(--foreground)]">Primary Text</div>
                <div className="font-mono text-[9px] text-[var(--text-tertiary)] mt-0.5">#F4F4F5</div>
              </div>
            </div>

          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}
