"use client"

import React, { useRef, useState, useEffect } from "react"
import { motion, useScroll, useTransform, Variants } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Philosophy() {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Scroll link for connection line
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  })

  // Animate pathLength from 0 to 1 as the philosophy block is scrolled past
  const pathLength = useTransform(scrollYProgress, [0.1, 0.8], [0, 1])

  // Option A Sandbox state
  const [fit, setFit] = useState(80)
  const [sizeIndex, setSizeIndex] = useState(2) // 51-200
  const [intentIndex, setIntentIndex] = useState(2) // High
  const [urgencyIndex, setUrgencyIndex] = useState(1) // Medium
  const [score, setScore] = useState(76)
  const [displayedScore, setDisplayedScore] = useState(76)

  const sizeOptions = [
    { label: "1-10", weight: 20 },
    { label: "11-50", weight: 50 },
    { label: "51-200", weight: 80 },
    { label: "201-500", weight: 100 },
    { label: "500+", weight: 90 },
  ]

  const intentOptions = [
    { label: "Low", weight: 20 },
    { label: "Medium", weight: 60 },
    { label: "High", weight: 100 },
  ]

  const urgencyOptions = [
    { label: "Low", weight: 10 },
    { label: "Medium", weight: 50 },
    { label: "High", weight: 100 },
  ]

  // Calculate score in real time
  useEffect(() => {
    const fitWeight = fit * 0.35
    const sizeWeight = sizeOptions[sizeIndex].weight * 0.20
    const intentWeight = intentOptions[intentIndex].weight * 0.25
    const urgencyWeight = urgencyOptions[urgencyIndex].weight * 0.20
    
    const computed = Math.round(fitWeight + sizeWeight + intentWeight + urgencyWeight)
    setScore(computed)
  }, [fit, sizeIndex, intentIndex, urgencyIndex])

  // Count/Animate display of score unless reduced motion is on
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedScore(score)
      return
    }

    const start = displayedScore
    const end = score
    if (start === end) return

    const duration = 250 // ms
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.round(start + (end - start) * progress)
      setDisplayedScore(current)

      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [score, prefersReducedMotion])

  const getStatus = (val: number) => {
    if (val >= 75) return { label: "Hot", bg: "bg-primary/12 text-primary border border-primary/20" }
    if (val >= 45) return { label: "Warm", bg: "bg-warning/12 text-warning border border-warning/20" }
    return { label: "Cold", bg: "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]" }
  }

  const status = getStatus(score)

  // Card list hover micro-animations variants
  const iconVariants: Variants = {
    rest: { rotate: 0, scale: 1 },
    hover: { 
      rotate: [0, -10, 10, 0],
      scale: 1.1,
      transition: { duration: 0.3, ease: "easeInOut" } 
    }
  }

  return (
    <section id="philosophy" ref={containerRef} className="py-24 border-t border-[var(--border-subtle)] bg-[var(--background)]">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"></span>
            Philosophy
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:text-4xl">
            Transform. Execute. Grow.
          </h2>
          <p className="text-[var(--muted-foreground)] leading-relaxed text-sm md:text-base">
            Everything in LeadForge OS follows one loop. Raw information becomes structured intelligence, structured intelligence becomes executed outreach, and executed outreach becomes pipeline — without ever leaving your machine.
          </p>
        </div>

        {/* Philosophy Columns */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Scroll-Linked Connection SVG Line (hidden on mobile, displayed on desktop) */}
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 -z-10 hidden md:block px-24">
            <svg className="w-full h-1" viewBox="0 0 1000 4" fill="none" preserveAspectRatio="none">
              <motion.path 
                d="M0 2 H1000" 
                stroke="var(--primary)" 
                strokeWidth="1.5" 
                strokeDasharray="4 4"
                style={{ pathLength: prefersReducedMotion ? 1 : pathLength }}
              />
            </svg>
          </div>

          {/* Column 1: Transform */}
          <motion.div 
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-6"
          >
            <div>
              <div className="font-mono text-xs font-semibold text-[var(--primary)] mb-4">01 — Transform</div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Turn a search into structured companies and contacts</h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-6">Discovery runs entirely on your desktop hardware.</p>
              
              <ul className="flex flex-col gap-4 text-xs">
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Maps discovery</b> — headless search finds companies by industry and geography.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 20l9-16H3z" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Website crawling</b> — a breadth-first crawler pulls verified emails and phone numbers from each domain.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="4" y="4" width="16" height="16" rx="3" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Decision-maker enrichment</b> — finds the CEO, founder, or VP behind each company, not just a generic inbox.
                  </span>
                </motion.li>
              </ul>
            </div>
          </motion.div>

          {/* Column 2: Execute */}
          <motion.div 
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.1, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-6"
          >
            <div>
              <div className="font-mono text-xs font-semibold text-[var(--primary)] mb-4">02 — Execute</div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Run the outreach without leaving the app</h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-6">Sequences, sending, and replies stay under one roof.</p>
              
              <ul className="flex flex-col gap-4 text-xs">
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 12h16M12 4v16" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Sequence builder</b> — drag-and-drop steps for waits, conditions, and sends, run in a sandboxed worker.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6h16v12H4z" />
                    <path d="M4 6l8 7 8-7" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Direct SMTP sending</b> — your own mail credentials, rate-limited and check-pointed, no shared sending pool.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" />
                    <path d="M9 12l2 2 4-4" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Reply detection</b> — an inbox poller stops a sequence the moment a contact replies, bounces, or unsubscribes.
                  </span>
                </motion.li>
              </ul>
            </div>
          </motion.div>

          {/* Column 3: Grow */}
          <motion.div 
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.2, ease: "easeOut" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] p-6"
          >
            <div>
              <div className="font-mono text-xs font-semibold text-[var(--primary)] mb-4">03 — Grow</div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Know which leads are worth your next hour</h3>
              <p className="text-xs text-[var(--muted-foreground)] mb-6">Every company is scored, not just stored.</p>
              
              <ul className="flex flex-col gap-4 text-xs">
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 20V10M12 20V4M20 20v-7" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Opportunity scoring</b> — fit, size, intent, and urgency combine into one 0–100 score, sorted into Hot, Warm, and Cold queues.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">Intent signals</b> — pricing pages, trial sign-ups, and case studies are read directly off a company's site.
                  </span>
                </motion.li>
                <motion.li whileHover="hover" initial="rest" className="flex gap-2.5 text-[var(--muted-foreground)] items-start cursor-default">
                  <motion.svg variants={iconVariants} className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1" />
                  </motion.svg>
                  <span>
                    <b className="text-[var(--foreground)] font-medium">AI-drafted opening lines</b> — grounded in the pain points found during discovery.
                  </span>
                </motion.li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Option A: Opportunity-Scoring Sandbox */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--card)] p-6 md:p-8"
        >
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sliders Configuration */}
            <div className="flex-1">
              <div className="mb-6">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--primary)] px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                  Interactive Simulation
                </span>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mt-2">
                  Opportunity Scoring Sandbox
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Interact with variables to simulate how the LeadForge OS local analytics engine ranks inbound leads.
                </p>
              </div>

              <div className="space-y-5">
                {/* Fit Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-[var(--foreground)]">Profile Fit (Fit score)</span>
                    <span className="font-mono text-[var(--primary)]">{fit}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={fit}
                    onChange={(e) => setFit(Number(e.target.value))}
                    className="w-full h-1 bg-[var(--background)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)] border-none outline-none"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-tertiary)] mt-1 select-none">
                    <span>Weak Match (0)</span>
                    <span>Exact ICP (100)</span>
                  </div>
                </div>

                {/* Company Size Options Selector */}
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                    Company Size (Employees)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {sizeOptions.map((opt, i) => (
                      <button
                        key={opt.label}
                        onClick={() => setSizeIndex(i)}
                        className={`py-1.5 rounded text-[10px] font-mono border transition-all duration-150 ${
                          sizeIndex === i
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intent Level Selector */}
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                    Intent Signals (Activity / Tech Stack updates)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {intentOptions.map((opt, i) => (
                      <button
                        key={opt.label}
                        onClick={() => setIntentIndex(i)}
                        className={`py-1.5 rounded text-[10px] font-mono border transition-all duration-150 ${
                          intentIndex === i
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Urgency Selector */}
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                    Urgency Indicators (Hiring spikes / Tech churn)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {urgencyOptions.map((opt, i) => (
                      <button
                        key={opt.label}
                        onClick={() => setUrgencyIndex(i)}
                        className={`py-1.5 rounded text-[10px] font-mono border transition-all duration-150 ${
                          urgencyIndex === i
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="w-full lg:w-[280px] rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted-foreground)]">
                    Local Record Preview
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">id: LF_829A</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">Company Profile</div>
                    <div className="text-xs font-semibold text-[var(--foreground)] leading-tight">Northline Analytics</div>
                    <div className="text-[9px] text-[var(--muted-foreground)]">SaaS · Austin, TX</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <div className="text-[9px] text-[var(--text-tertiary)]">ICP Fit</div>
                      <div className="text-[10px] font-mono text-[var(--foreground)] font-medium">{fit >= 70 ? "High Match" : fit >= 35 ? "Medium" : "Weak Match"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[var(--text-tertiary)]">Employees</div>
                      <div className="text-[10px] font-mono text-[var(--foreground)] font-medium">{sizeOptions[sizeIndex].label}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <div className="text-[9px] text-[var(--text-tertiary)]">Web Intent</div>
                      <div className="text-[10px] font-mono text-[var(--foreground)] font-medium">{intentOptions[intentIndex].label}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[var(--text-tertiary)]">Local Urgency</div>
                      <div className="text-[10px] font-mono text-[var(--foreground)] font-medium">{urgencyOptions[urgencyIndex].label}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Score Indicator Area */}
              <div className="mt-8 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-[var(--text-tertiary)]">Calculated Priority</div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-3xl font-semibold font-mono tracking-tight text-[var(--foreground)]">
                        {displayedScore}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">/100</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-[var(--text-tertiary)] mb-1">Queue Status</span>
                    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-semibold transition-all duration-300 ${status.bg}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Score Progress Track Bar */}
                <div className="mt-3.5 h-1.5 w-full bg-[var(--border-subtle)] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[var(--primary)] rounded-full"
                    animate={{ width: `${score}%` }}
                    transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 15 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
