"use client"

import React, { useRef, useState, useEffect } from "react"
import { motion, useScroll, useTransform, Variants } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { Shield, Sparkles, Send, Target, Compass, Network, HelpCircle } from "lucide-react"

export function Philosophy() {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Scroll linked path animation
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  })
  const pathLength = useTransform(scrollYProgress, [0.1, 0.8], [0, 1])

  // Sandbox states
  const [fit, setFit] = useState(85)
  const [sizeIndex, setSizeIndex] = useState(2) // 51-200
  const [intentIndex, setIntentIndex] = useState(2) // High
  const [urgencyIndex, setUrgencyIndex] = useState(1) // Medium
  const [score, setScore] = useState(82)
  const [displayedScore, setDisplayedScore] = useState(82)

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

  // Calculate score
  useEffect(() => {
    const fitWeight = fit * 0.35
    const sizeWeight = sizeOptions[sizeIndex].weight * 0.20
    const intentWeight = intentOptions[intentIndex].weight * 0.25
    const urgencyWeight = urgencyOptions[urgencyIndex].weight * 0.20

    const computed = Math.round(fitWeight + sizeWeight + intentWeight + urgencyWeight)
    setScore(computed)
  }, [fit, sizeIndex, intentIndex, urgencyIndex])

  // Count/Animate display of score
  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedScore(score)
      return
    }

    const start = displayedScore
    const end = score
    if (start === end) return

    const duration = 250
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
    if (val >= 75) return { label: "Priority: Hot", bg: "bg-primary/10 text-primary border-primary/20" }
    if (val >= 45) return { label: "Priority: Warm", bg: "bg-amber-500/10 text-amber-400 border-amber-500/20" }
    return { label: "Priority: Cold", bg: "bg-zinc-800 text-zinc-400 border-zinc-700" }
  }

  const status = getStatus(score)

  const iconVariants: Variants = {
    rest: { rotate: 0, scale: 1 },
    hover: {
      rotate: [0, -10, 10, 0],
      scale: 1.1,
      transition: { duration: 0.3, ease: "easeInOut" }
    }
  }

  return (
    <section id="philosophy" ref={containerRef} className="py-24 border-t border-[var(--border-subtle)] bg-[#09090B] relative overflow-hidden lg:px-32 md:px-20 px-4">
      {/* Subtle background details */}
      <div className="absolute top-[10%] left-[20%] w-[250px] h-[250px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="container mx-auto px-6">

        {/* Section Header */}
        <div className="max-w-2xl mb-16 text-left">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
            Core Philosophy
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4 md:text-4xl">
            Clean pipelines, local execution.
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed text-xs sm:text-sm">
            We believe B2B outbound workflows should run locally inside your system container. Everything follows a zero-loss cycle: discover, qualify, verify, and dispatch.
          </p>
        </div>

        {/* Philosophy Columns */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 select-none">
          {/* Scroll-Linked Connection SVG Line */}
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
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[rgba(10,10,12,0.45)] backdrop-blur p-6 text-left hover:border-[var(--border-strong)] transition-all duration-200"
          >
            <div>
              <div className="font-mono text-[10px] font-bold text-[var(--primary)] mb-4">01 — Pipeline Discovery</div>
              <h3 className="text-sm font-bold text-white mb-2">Turn local searches into verified profiles</h3>
              <p className="text-[10px] text-[var(--text-tertiary)] mb-6">HEADLESS Google Maps scraping crawls listings directly.</p>

              <ul className="flex flex-col gap-4 text-[11px] text-[var(--text-secondary)] font-sans">
                <li className="flex gap-2.5 items-start">
                  <Compass className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">Headless Scrapers</b> — local Chromium containers parse listing maps.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <Network className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">Domain Crawling</b> — asynchronous loops scan homepages for verified handles.
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Column 2: Execute */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.1 }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[rgba(10,10,12,0.45)] backdrop-blur p-6 text-left hover:border-[var(--border-strong)] transition-all duration-200"
          >
            <div>
              <div className="font-mono text-[10px] font-bold text-[var(--primary)] mb-4">02 — SMTP Execution</div>
              <h3 className="text-sm font-bold text-white mb-2">Run sequences without third-party middleware</h3>
              <p className="text-[10px] text-[var(--text-tertiary)] mb-6">Maintains direct SMTP socket connections locally.</p>

              <ul className="flex flex-col gap-4 text-[11px] text-[var(--text-secondary)] font-sans">
                <li className="flex gap-2.5 items-start">
                  <Send className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">Direct Sockets</b> — connects straight to mail exchange hosts.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <Shield className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">Encrypted Storage</b> — handles credentials in the OS secure vault.
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Column 3: Grow */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.2 }}
            className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[rgba(10,10,12,0.45)] backdrop-blur p-6 text-left hover:border-[var(--border-strong)] transition-all duration-200"
          >
            <div>
              <div className="font-mono text-[10px] font-bold text-[var(--primary)] mb-4">03 — Local Intel</div>
              <h3 className="text-sm font-bold text-white mb-2">Score and prioritize leads on hardware</h3>
              <p className="text-[10px] text-[var(--text-tertiary)] mb-6">Runs qualification scoring using local vectors.</p>

              <ul className="flex flex-col gap-4 text-[11px] text-[var(--text-secondary)] font-sans">
                <li className="flex gap-2.5 items-start">
                  <Target className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">Fit Analysis</b> — weights ICP rules instantly inside the sandbox.
                  </span>
                </li>
                <li className="flex gap-2.5 items-start">
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--primary)] mt-0.5" />
                  <span>
                    <b className="text-white font-medium">AI Copywriting</b> — drafts custom hooks based on domain scrapes.
                  </span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Scoring Sandbox */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(10,10,12,0.55)] backdrop-blur p-6 md:p-8 text-left max-w-4xl mx-auto fresnel-highlight"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sliders Configuration */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--primary)] px-2.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  Simulation Center
                </span>
                <h3 className="text-base font-bold text-white mt-2 font-mono">
                  Opportunity Scoring Engine
                </h3>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Simulate local weighting coefficients mapping variables directly to priority tiers.
                </p>
              </div>

              <div className="space-y-6">
                {/* Fit Slider */}
                <div>
                  <div className="flex justify-between text-[11px] mb-2 font-mono">
                    <span className="text-[var(--text-secondary)]">Profile Match (Fit weight)</span>
                    <span className="text-[var(--primary)] font-bold">{fit}%</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fit}
                      onChange={(e) => setFit(Number(e.target.value))}
                      className="w-full h-1 bg-[var(--background)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)] outline-none"
                    />
                  </div>
                  <div className="flex justify-between text-[8.5px] text-[var(--text-tertiary)] font-mono mt-1.5 select-none">
                    <span>Weak ICP Fit</span>
                    <span>Exact Profile Match</span>
                  </div>
                </div>

                {/* Company Size Selector */}
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-secondary)] mb-2">
                    Company Scale (FTEs)
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 font-mono">
                    {sizeOptions.map((opt, i) => (
                      <motion.button
                        key={opt.label}
                        onClick={() => setSizeIndex(i)}
                        whileHover={{ scale: 1.03, y: -0.5 }}
                        whileTap={{ scale: 0.98 }}
                        className={`py-1.5 rounded text-[9.5px] border transition-all cursor-pointer ${sizeIndex === i
                            ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                            : "bg-[var(--background)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                          }`}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Intent Level Selector */}
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-secondary)] mb-2">
                    Tech Stack Intent Signals
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    {intentOptions.map((opt, i) => (
                      <motion.button
                        key={opt.label}
                        onClick={() => setIntentIndex(i)}
                        whileHover={{ scale: 1.03, y: -0.5 }}
                        whileTap={{ scale: 0.98 }}
                        className={`py-1.5 rounded text-[9.5px] border transition-all cursor-pointer ${intentIndex === i
                            ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                            : "bg-[var(--background)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                          }`}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Urgency Selector */}
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-secondary)] mb-2">
                    Hiring Activity &amp; Growth Spikes
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    {urgencyOptions.map((opt, i) => (
                      <motion.button
                        key={opt.label}
                        onClick={() => setUrgencyIndex(i)}
                        whileHover={{ scale: 1.03, y: -0.5 }}
                        whileTap={{ scale: 0.98 }}
                        className={`py-1.5 rounded text-[9.5px] border transition-all cursor-pointer ${urgencyIndex === i
                            ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                            : "bg-[var(--background)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                          }`}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Record Card */}
            <div className="lg:col-span-1 rounded-lg border border-[var(--border-subtle)] bg-[rgba(9,9,10,0.85)] p-5 flex flex-col justify-between font-mono">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
                  <span className="text-[7.5px] uppercase text-[var(--text-tertiary)] font-bold">
                    Database Record Preview
                  </span>
                  <span className="text-[8px] text-[var(--text-tertiary)]">ID: local_7a9f</span>
                </div>

                <div className="space-y-3.5 text-[9.5px]">
                  <div>
                    <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">Lead Domain</div>
                    <div className="text-white font-bold leading-tight mt-0.5">vertex-solutions.io</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-[var(--border-subtle)]">
                    <div>
                      <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">ICP Status</div>
                      <div className="text-white mt-0.5 font-bold">{fit >= 70 ? "ICP Match" : fit >= 35 ? "Partial Match" : "Low Match"}</div>
                    </div>
                    <div>
                      <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">Scale Tier</div>
                      <div className="text-white mt-0.5 font-bold">{sizeOptions[sizeIndex].label} FTEs</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2.5">
                    <div>
                      <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">Intent Level</div>
                      <div className="text-white mt-0.5 font-bold">{intentOptions[intentIndex].label}</div>
                    </div>
                    <div>
                      <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">Growth Urgency</div>
                      <div className="text-white mt-0.5 font-bold">{urgencyOptions[urgencyIndex].label}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Score output */}
              <div className="mt-8 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[7.5px] text-[var(--text-tertiary)] uppercase">Lead Score</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-semibold tracking-tight text-white">
                        {displayedScore}
                      </span>
                      <span className="text-[9px] text-[var(--text-tertiary)]">/100</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[7.5px] text-[var(--text-tertiary)] uppercase mb-1">Queue status</span>
                    <span className={`inline-flex items-center rounded px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase transition-all duration-300 ${status.bg}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1.5 w-full bg-[var(--border-subtle)] rounded-full overflow-hidden">
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
