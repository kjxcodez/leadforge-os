"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Mail, CheckCircle2 } from "lucide-react"

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

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
            Contact
          </motion.div>
          <motion.h1 variants={childVariants} className="text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
            Get in touch
          </motion.h1>
          <motion.p variants={childVariants} className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Have questions about system APIs, custom SMTP relayer setups, or business licenses? Drop us a line.
          </motion.p>
        </div>

        {/* Form Container */}
        <motion.div variants={childVariants} className="border border-[var(--border)] rounded-lg p-6 bg-[var(--card)]">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form 
                key="form"
                onSubmit={handleSubmit}
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
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">Message / Inquiry</label>
                  <textarea 
                    required 
                    rows={4}
                    placeholder="How can our engineering team assist you?"
                    className="w-full p-3 rounded bg-[var(--background)] border border-[var(--border-subtle)] text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none transition-all resize-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full h-9 rounded bg-[var(--primary)] text-xs font-semibold text-[var(--primary-foreground)] hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Submit Inquiry
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
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Inquiry Received</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                    We will get back to you shortly. You can also view active code updates in our GitHub repository.
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
