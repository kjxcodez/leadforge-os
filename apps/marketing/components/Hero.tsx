"use client"

import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { Button } from "@/components/ui/button"

// Simulated operation logs for Option B
const SIMULATED_LOGS = [
  { time: "22:45:01", type: "system", message: "SQLite WAL mode initialized." },
  { time: "22:45:02", type: "discovery", message: "Query 'SaaS in Austin, TX' initiated." },
  { time: "22:45:03", type: "discovery", message: "Found 12 candidate domains on Google Maps." },
  { time: "22:45:04", type: "scraper", message: "Crawling fieldstack.com..." },
  { time: "22:45:05", type: "scraper", message: "Found email: hello@fieldstack.com" },
  { time: "22:45:06", type: "enricher", message: "Identified Founder: Jane Doe" },
  { time: "22:45:07", type: "enricher", message: "Verified SMTP target: j.doe@fieldstack.com" },
  { time: "22:45:08", type: "sqlite", message: "Saved lead 'Fieldstack' -> Hot (Score: 76)" },
  { time: "22:45:09", type: "outreach", message: "SMTP sequence step 1 dispatched via local SMTP." },
  { time: "22:45:11", type: "scraper", message: "Crawling loomcast.dev..." },
  { time: "22:45:12", type: "scraper", message: "Found email: contact@loomcast.dev" },
  { time: "22:45:13", type: "enricher", message: "Identified Director: John Smith" },
  { time: "22:45:14", type: "sqlite", message: "Saved lead 'Loomcast' -> Warm (Score: 58)" },
  { time: "22:45:15", type: "system", message: "Local-first SQLite database in sync with Cloud API." },
]

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [converged, setConverged] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [activeLogs, setActiveLogs] = useState<typeof SIMULATED_LOGS>([])
  const [logIndex, setLogIndex] = useState(0)

  // Trigger convergence after a delay
  useEffect(() => {
    if (prefersReducedMotion) {
      setConverged(true)
      return
    }
    const timer = setTimeout(() => {
      setConverged(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [prefersReducedMotion])

  // Canvas background nodes animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Retrieve active CSS variables dynamically from global stylesheet
    const getCssVar = (name: string, fallback: string) => {
      if (typeof window === "undefined") return fallback
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    }

    const primaryColor = getCssVar("--primary", "#E8622C")
    const borderColor = getCssVar("--border", "#2E2E33")
    const foregroundColor = getCssVar("--foreground", "#F4F4F5")

    let animationFrameId: number
    const gridRows = 6
    const gridCols = 8
    const numNodes = gridRows * gridCols // 48 nodes

    interface Node {
      x: number
      y: number
      vx: number
      vy: number
      scatterX: number
      scatterY: number
      targetX: number
      targetY: number
      isAccent: boolean
    }

    let nodes: Node[] = []

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
      canvas.height = canvas.parentElement?.clientHeight || 650

      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      
      // Responsive spacing for the structured grid behind the CRM panel
      const isMobile = window.innerWidth < 768
      const colSpacing = isMobile ? 40 : 80
      const rowSpacing = isMobile ? 30 : 50

      nodes = []
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const targetX = centerX + (c - (gridCols - 1) / 2) * colSpacing
          const targetY = centerY + (r - (gridRows - 1) / 2) * rowSpacing + 40

          // Initial scattered position
          const scatterX = Math.random() * canvas.width
          const scatterY = Math.random() * canvas.height

          // Orange accent for 20% of nodes, white/gray for the rest
          const isAccent = Math.random() < 0.2

          nodes.push({
            x: prefersReducedMotion ? targetX : scatterX,
            y: prefersReducedMotion ? targetY : scatterY,
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            scatterX,
            scatterY,
            targetX,
            targetY,
            isAccent,
          })
        }
      }

      // Draw immediately for reduced motion
      if (prefersReducedMotion) {
        drawReduced()
      }
    }

    const drawReduced = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw grid lines
      ctx.save()
      ctx.strokeStyle = borderColor
      ctx.globalAlpha = 0.3
      ctx.lineWidth = 1

      // Vertical lines
      for (let c = 0; c < gridCols; c++) {
        ctx.beginPath()
        const startNode = nodes[c]
        const endNode = nodes[(gridRows - 1) * gridCols + c]
        if (startNode && endNode) {
          ctx.moveTo(startNode.x, startNode.y)
          ctx.lineTo(endNode.x, endNode.y)
          ctx.stroke()
        }
      }

      // Horizontal lines
      for (let r = 0; r < gridRows; r++) {
        ctx.beginPath()
        const startNode = nodes[r * gridCols]
        const endNode = nodes[r * gridCols + (gridCols - 1)]
        if (startNode && endNode) {
          ctx.moveTo(startNode.x, startNode.y)
          ctx.lineTo(endNode.x, endNode.y)
          ctx.stroke()
        }
      }
      ctx.restore()

      // Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)
        ctx.save()
        if (node.isAccent) {
          ctx.fillStyle = primaryColor
        } else {
          ctx.fillStyle = foregroundColor
          ctx.globalAlpha = 0.4
        }
        ctx.fill()
        ctx.restore()
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 1. Update positions
      nodes.forEach((node) => {
        if (converged) {
          // Linear interpolation to target coordinates
          node.x += (node.targetX - node.x) * 0.05
          node.y += (node.targetY - node.y) * 0.05
        } else {
          // Drifting
          node.scatterX += node.vx
          node.scatterY += node.vy
          
          // Bounce off boundaries
          if (node.scatterX < 0 || node.scatterX > canvas.width) node.vx *= -1
          if (node.scatterY < 0 || node.scatterY > canvas.height) node.vy *= -1

          node.x = node.scatterX
          node.y = node.scatterY
        }
      })

      // 2. Draw connection lines
      ctx.save()
      ctx.strokeStyle = borderColor
      if (converged) {
        // Draw rigid database grid lines with fading intensity
        ctx.globalAlpha = 0.25
        ctx.lineWidth = 1

        // Vertical columns lines
        for (let c = 0; c < gridCols; c++) {
          ctx.beginPath()
          const startNode = nodes[c]
          const endNode = nodes[(gridRows - 1) * gridCols + c]
          if (startNode && endNode) {
            ctx.moveTo(startNode.x, startNode.y)
            ctx.lineTo(endNode.x, endNode.y)
            ctx.stroke()
          }
        }

        // Horizontal row lines
        for (let r = 0; r < gridRows; r++) {
          ctx.beginPath()
          const startNode = nodes[r * gridCols]
          const endNode = nodes[r * gridCols + (gridCols - 1)]
          if (startNode && endNode) {
            ctx.moveTo(startNode.x, startNode.y)
            ctx.lineTo(endNode.x, endNode.y)
            ctx.stroke()
          }
        }
      } else {
        // Draw distance-based lines representing scattered market chaos
        ctx.globalAlpha = 0.12
        ctx.lineWidth = 0.8
        for (let i = 0; i < numNodes; i++) {
          for (let j = i + 1; j < numNodes; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 90) {
              ctx.beginPath()
              ctx.moveTo(nodes[i].x, nodes[i].y)
              ctx.lineTo(nodes[j].x, nodes[j].y)
              ctx.stroke()
            }
          }
        }
      }
      ctx.restore()

      // 3. Draw nodes
      nodes.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2)
        ctx.save()
        if (node.isAccent) {
          ctx.fillStyle = primaryColor
        } else {
          ctx.fillStyle = foregroundColor
          ctx.globalAlpha = 0.4
        }
        ctx.fill()
        ctx.restore()
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    window.addEventListener("resize", resizeCanvas)
    resizeCanvas()

    if (!prefersReducedMotion) {
      animate()
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [converged, prefersReducedMotion])

  // Log simulation for Option B
  useEffect(() => {
    if (prefersReducedMotion) {
      // Instantly show the last 5 logs for reduced motion
      setActiveLogs(SIMULATED_LOGS.slice(-5))
      return
    }

    const interval = setInterval(() => {
      setLogIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % (SIMULATED_LOGS.length + 1)
        if (nextIndex === 0) {
          setActiveLogs([])
          return 0
        }
        
        setActiveLogs((prevLogs) => {
          const currentLog = SIMULATED_LOGS[nextIndex - 1]
          // Cap at 4 logs in display area for clean layout
          const updatedLogs = [...prevLogs, currentLog]
          if (updatedLogs.length > 4) {
            updatedLogs.shift()
          }
          return updatedLogs
        })
        return nextIndex
      })
    }, 1800)

    // Initial log seed
    setActiveLogs([SIMULATED_LOGS[0]])
    setLogIndex(1)

    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  // Animations configuration for motion/react
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  } as const

  const childVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  } as const

  return (
    <section className="relative flex flex-col items-center overflow-hidden border-t-0 bg-transparent pt-32 pb-24">
      {/* Background Canvas Node System */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 -z-10 block h-full w-full pointer-events-none opacity-60"
      />

      <div className="container mx-auto px-6 text-center">
        {/* Eyebrow Notification */}
        <motion.div
          variants={childVariants}
          initial={prefersReducedMotion ? "visible" : "hidden"}
          animate="visible"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--primary)]"></span>
          </span>
          Now shipping on Windows — macOS &amp; Linux in progress
        </motion.div>

        {/* Headlines and CTAs */}
        <motion.div
          variants={containerVariants}
          initial={prefersReducedMotion ? "visible" : "hidden"}
          animate="visible"
          className="flex flex-col items-center"
        >
          <motion.h1
            variants={childVariants}
            className="mx-auto mb-6 max-w-4xl text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl lg:text-6xl lg:leading-[1.08]"
          >
            A local-first desktop OS for finding and closing your next customer.
          </motion.h1>

          <motion.p
            variants={childVariants}
            className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)] md:text-lg"
          >
            LeadForge OS discovers companies, enriches contacts, and runs outreach sequences from a single desktop app — running on your machine, not someone else's cloud.
          </motion.p>

          <motion.div
            variants={childVariants}
            className="mb-20 flex flex-wrap justify-center gap-3"
          >
            <a
              href="#downloads"
              className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--primary)] px-6 font-medium text-[var(--primary-foreground)] hover:bg-[oklch(0.698_0.167_41.6)] transition-colors duration-150 text-sm"
            >
              Download for Windows
            </a>
            <a
              href="#architecture"
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--card)] px-6 font-medium text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors duration-150 text-sm"
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>

        {/* CRM Panel (Option B Log Terminal integrated) */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-4xl"
        >
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--card)] shadow-2xl overflow-hidden text-left">
            {/* Window Top Bar */}
            <div className="flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--card)] px-4">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
                <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
                <span className="h-2 w-2 rounded-full bg-[var(--border-strong)] opacity-60"></span>
              </div>
              <div className="font-mono text-[10px] text-[var(--muted-foreground)]">
                workspace / austin-saas-q1
              </div>
              <div className="w-12"></div>
            </div>

            {/* Panel Body */}
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-[340px]">
              {/* Sidebar */}
              <div className="hidden border-r border-[var(--border-subtle)] bg-[var(--background)] p-5 md:block">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] bg-[var(--accent)] bg-opacity-[0.12] border-l-2 border-[var(--primary)] pl-[8px]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                    Local CRM
                  </div>
                  <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                    </svg>
                    Discovery
                  </div>
                  <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 4l16 8-16 8V4z" />
                    </svg>
                    Campaigns
                  </div>
                  <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 3v18M3 12h18" />
                    </svg>
                    Sequences
                  </div>
                  <div className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 12h4l2 6 4-16 2 10h4" />
                    </svg>
                    Operations
                  </div>
                </div>
              </div>

              {/* Main Panel Content */}
              <div className="flex flex-col p-6">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Companies — Austin, TX · SaaS
                </div>
                
                {/* Lead Table */}
                <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] flex-grow">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--muted)] text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-mono border-b border-[var(--border-subtle)]">
                        <th className="px-4 py-2.5 font-normal">Company</th>
                        <th className="px-4 py-2.5 font-normal">Contact</th>
                        <th className="px-4 py-2.5 font-normal">Score</th>
                        <th className="px-4 py-2.5 font-normal text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground)]">Northline Analytics</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">northline.io</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">VP Sales</td>
                        <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">82</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-primary/12 text-primary">Hot</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground)]">Fieldstack</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">fieldstack.com</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">Founder</td>
                        <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">76</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-primary/12 text-primary">Hot</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground)]">Loomcast</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">loomcast.dev</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">Director, Ops</td>
                        <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">58</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-warning/12 text-warning">Warm</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--foreground)]">Grayline Studio</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">grayline.co</div>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">Manager</td>
                        <td className="px-4 py-3 font-mono text-[var(--muted-foreground)]">33</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-[var(--secondary)] text-[var(--muted-foreground)]">Cold</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Option B: Embedded Scraper Operations Log Console */}
                <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75"></span>
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]"></span>
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        Local Output Console
                      </span>
                    </div>
                    <span className="font-mono text-[8px] text-[var(--muted-foreground)]">
                      127.0.0.1 · SQLite WAL
                    </span>
                  </div>

                  <div className="min-h-[85px] font-mono text-[10px] leading-relaxed text-[var(--muted-foreground)] overflow-hidden flex flex-col justify-end">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {activeLogs.map((log, index) => (
                        <motion.div
                          key={log.time + index}
                          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="flex gap-2 py-[1px]"
                        >
                          <span className="text-[var(--text-tertiary)] flex-shrink-0 select-none">[{log.time}]</span>
                          <span className="flex-shrink-0 select-none text-[var(--primary)]">[{log.type}]</span>
                          <span className="text-[var(--foreground)] truncate">{log.message}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  )
}
