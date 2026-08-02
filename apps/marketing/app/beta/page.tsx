"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { CheckCircle2, Star, Sparkles, Send } from "lucide-react"

export default function BetaPage() {
  const [submitted, setSubmitted] = useState(false)

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
        className="max-w-xl mx-auto space-y-12"
      >
        {/* Header Block */}
        <div className="space-y-4">
          <motion.div variants={childVariants} className="text-[10px] font-mono uppercase tracking-wider text-[var(--primary)] font-semibold">
            Beta Program
          </motion.div>
          <motion.h1 variants={childVariants} className="text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
            Join the Beta
          </motion.h1>
          <motion.p variants={childVariants} className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Test the latest pre-release versions of LeadForge OS. Help us find edge cases in SMTP handshakes and WAL checkpoints.
          </motion.p>
        </div>

        {/* Form Container */}
        <motion.div variants={childVariants} className="border border-[var(--border)] rounded-lg p-6 bg-[var(--card)]">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form 
                key="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitted(true)
                }}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    placeholder="operator@company.com"
                    className="w-full h-9 px-3 rounded bg-[var(--background)] border border-[var(--border-subtle)] text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">Primary OS / Environment</label>
                  <select 
                    required
                    className="w-full h-9 px-3 rounded bg-[var(--background)] border border-[var(--border-subtle)] text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none transition-all"
                  >
                    <option value="win">Windows 10 / 11 (x64)</option>
                    <option value="mac-arm">macOS (Apple Silicon M1/M2/M3)</option>
                    <option value="mac-intel">macOS (Intel)</option>
                    <option value="linux">Linux (Debian / Fedora / AppImage)</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  className="w-full h-9 rounded bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  Apply for Beta Access
                </button>
              </motion.form>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 text-center py-6"
              >
                <CheckCircle2 className="h-10 w-10 text-[var(--success)] mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Application Received</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                    Thanks for applying! We will notify you via email as soon as new slots open up in the beta releases channel.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </motion.div>
    </div>
  )
}
