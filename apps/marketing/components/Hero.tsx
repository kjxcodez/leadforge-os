"use client"

import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "motion/react"
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

const MOCK_COMPANIES = [
  {
    name: "Top HVAC NYC",
    domain: "hvacairconditionersnyc.com",
    status: "LEAD",
    type: "Warm Lead",
    typeStyle: "bg-warning/12 text-warning border border-warning/20",
    overall: 49,
    fit: "60%",
    size: "65%",
    intent: "40%",
    urgency: "30%",
    summary: "Top HVAC NYC is a B2B company operating in the general NYC service sector.",
    angle: "“Saw that you guys are building out your digital infrastructure...”",
    phone: "+1 646-493-4904",
    location: "New York, NY",
    emails: "support@hvacairconditionersnyc.com"
  },
  {
    name: "American HVAC Corp",
    domain: "americanhvac.nyc",
    status: "LEAD",
    type: "Hot Lead",
    typeStyle: "bg-primary/12 text-primary border border-primary/20",
    overall: 83,
    fit: "90%",
    size: "85%",
    intent: "80%",
    urgency: "75%",
    summary: "American HVAC Corp is a large-scale contractor specializing in commercial ventilation systems.",
    angle: "“Given your focus on commercial HVAC retrofits in NYC, our local pipeline automation...”",
    phone: "+1 347-382-9030",
    location: "368 9th Ave 6th floor, New York, NY",
    emails: "info@americanhvaccorp.com"
  },
  {
    name: "212 HVAC Brooklyn",
    domain: "212hvac.com",
    status: "LEAD",
    type: "Hot Lead",
    typeStyle: "bg-primary/12 text-primary border border-primary/20",
    overall: 76,
    fit: "80%",
    size: "70%",
    intent: "75%",
    urgency: "80%",
    summary: "212 HVAC Brooklyn provides residential and light commercial installations across Kings County.",
    angle: "“Noticed your team is scaling dispatch operations in Brooklyn. We verify decision makers...”",
    phone: "+1 917-633-5959",
    location: "300 Morgan Ave Ste P, Brooklyn, NY",
    emails: "info@212hvac.com"
  },
  {
    name: "Airnizer HVAC",
    domain: "airnizer.co",
    status: "LEAD",
    type: "Cold Lead",
    typeStyle: "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]",
    overall: 38,
    fit: "45%",
    size: "50%",
    intent: "30%",
    urgency: "25%",
    summary: "Airnizer HVAC is a boutique heating and cooling provider focusing on residential smart-home integrations.",
    angle: "“Since you are focusing on residential smart home installs, a targeted local sequence...”",
    phone: "+1 347-745-7768",
    location: "175 Pearl St Fl 1, Brooklyn, NY",
    emails: "airnizer@yahoo.com"
  }
]

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [converged, setConverged] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [activeLogs, setActiveLogs] = useState<typeof SIMULATED_LOGS>([])
  const [logIndex, setLogIndex] = useState(0)
  const [selectedCompanyIdx, setSelectedCompanyIdx] = useState(0)
  const [activeTab, setActiveTab] = useState<"CRM" | "Intelligence">("Intelligence")

  // Cursor-reactive tilt variables
  const panelRef = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const mouseXSpring = useSpring(mouseX, { damping: 35, stiffness: 180 })
  const mouseYSpring = useSpring(mouseY, { damping: 35, stiffness: 180 })

  const rotateX = useTransform(mouseYSpring, [0, 1], [2.5, -2.5])
  const rotateY = useTransform(mouseXSpring, [0, 1], [-2.5, 2.5])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current || prefersReducedMotion) return
    const rect = panelRef.current.getBoundingClientRect()
    const xVal = (e.clientX - rect.left) / rect.width
    const yVal = (e.clientY - rect.top) / rect.height
    mouseX.set(xVal)
    mouseY.set(yVal)
  }

  const handleMouseLeave = () => {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

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
          ref={panelRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
          style={{
            rotateX: prefersReducedMotion ? 0 : rotateX,
            rotateY: prefersReducedMotion ? 0 : rotateY,
            transformStyle: "preserve-3d" as const,
            perspective: 1000,
          }}
          className="mx-auto max-w-4xl"
        >
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--card)] shadow-2xl overflow-hidden text-left transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(232,98,44,0.06)]">
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
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_270px] min-h-[460px] bg-[var(--background)]">
              
              {/* Sidebar Column */}
              <div className="hidden border-r border-[var(--border-subtle)] p-3 md:flex flex-col justify-between select-none">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="9" rx="1" />
                      <rect x="14" y="3" width="7" height="5" rx="1" />
                      <rect x="14" y="12" width="7" height="9" rx="1" />
                      <rect x="3" y="16" width="7" height="5" rx="1" />
                    </svg>
                    Dashboard
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--foreground)] bg-[var(--accent)] bg-opacity-[0.12] border-l-2 border-[var(--primary)] pl-[8px]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                    Companies
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Contacts
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
                    </svg>
                    Campaigns
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                    </svg>
                    Discovery
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="m12 3-1.912 5.886H3.888L8.93 12.518 7.018 18.4l5-3.63 4.98 3.63-1.91-5.88 5.04-3.63h-6.2Z" />
                    </svg>
                    Automation
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                    Reports
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Settings
                  </div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-150">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Operations Center
                  </div>
                </div>

                <div className="mt-8 border-t border-[var(--border-subtle)] pt-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--primary)] text-[10px] font-bold text-[var(--primary-foreground)] select-none">
                    G
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium text-[var(--foreground)] leading-tight">greentechmodelers@...</div>
                    <div className="truncate text-[8px] text-[var(--muted-foreground)] font-mono">My Leads Workspace</div>
                  </div>
                </div>
              </div>

              {/* Center Workspace Column */}
              <div className="flex flex-col p-5 border-r border-[var(--border-subtle)] min-w-0 justify-between">
                <div>
                  {/* Companies Toolbar Title & Actions */}
                  <div className="flex items-center justify-between mb-3 select-none">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">Companies</h3>
                      <p className="text-[9px] text-[var(--muted-foreground)]">Manage accounts, details, notes, and activity pipelines.</p>
                    </div>
                    <button className="h-6 px-2.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-opacity-90 text-[10px] font-semibold flex items-center gap-1.5 transition-colors duration-150 cursor-pointer">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Add Company
                    </button>
                  </div>

                  {/* Search / Filters Bar */}
                  <div className="flex gap-2 mb-4 select-none">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        placeholder="Search by keyword..." 
                        disabled
                        className="w-full h-7 pl-6.5 pr-2 rounded bg-[var(--background)] border border-[var(--border-subtle)] text-[10px] text-[var(--muted-foreground)] select-none pointer-events-none"
                      />
                      <svg className="absolute left-2.5 top-[7.5px] h-3 w-3 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                    </div>
                    <div className="h-7 px-2.5 rounded bg-[var(--background)] border border-[var(--border-subtle)] text-[10px] text-[var(--muted-foreground)] flex items-center gap-1 pointer-events-none">
                      All Statuses
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Lead Table */}
                  <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--card)]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[var(--muted)] text-[9px] uppercase tracking-wider text-[var(--muted-foreground)] font-mono border-b border-[var(--border-subtle)] select-none">
                          <th className="px-3 py-2 w-7 font-normal">
                            <input type="checkbox" disabled checked className="pointer-events-none rounded border-[var(--border-subtle)] bg-[var(--background)]" />
                          </th>
                          <th className="px-3 py-2 font-normal">Company Name</th>
                          <th className="px-3 py-2 font-normal">Domain</th>
                          <th className="px-3 py-2 font-normal">Status</th>
                          <th className="px-3 py-2 font-normal text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] text-[10px] select-none cursor-pointer">
                        {MOCK_COMPANIES.map((company, index) => {
                          const isSelected = selectedCompanyIdx === index
                          return (
                            <tr 
                              key={company.name}
                              onClick={() => setSelectedCompanyIdx(index)}
                              className={`transition-colors duration-150 ${
                                isSelected 
                                  ? "bg-[var(--accent)] bg-opacity-25 border-l-2 border-[var(--primary)] pl-[6px]" 
                                  : "hover:bg-[var(--accent)] hover:bg-opacity-10"
                              }`}
                            >
                              <td className="px-3 py-2.5">
                                <input 
                                  type="checkbox" 
                                  readOnly 
                                  checked={isSelected} 
                                  className="rounded border-[var(--border-subtle)] bg-[var(--background)] pointer-events-none" 
                                />
                              </td>
                              <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">{company.name}</td>
                              <td className={`px-3 py-2.5 truncate font-mono ${isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>
                                {company.domain}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center rounded-md px-1.5 py-0.2 text-[8px] font-mono font-medium border border-[var(--border-subtle)] bg-[var(--muted)] text-[var(--muted-foreground)]">
                                  {company.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[9px] text-[var(--muted-foreground)]">Edit</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Option B: Embedded Scraper Operations Log Console */}
                <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] p-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2 select-none">
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

              {/* Right Side Drawer Panel (Representing Screenshot 4) */}
              <div className="hidden lg:flex flex-col p-4 select-none min-w-0 bg-[var(--card)] w-[270px] shrink-0">
                {/* Header Information */}
                <div className="flex items-start justify-between mb-4 border-b border-[var(--border-subtle)] pb-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-[var(--foreground)] truncate leading-tight">
                      {MOCK_COMPANIES[selectedCompanyIdx].name}
                    </h4>
                    <span className="text-[9px] font-mono text-[var(--primary)] truncate block mt-0.5">
                      {MOCK_COMPANIES[selectedCompanyIdx].domain}
                    </span>
                  </div>
                  <span className="h-4.5 w-4.5 rounded border border-[var(--border-subtle)] text-[10px] text-[var(--muted-foreground)] flex items-center justify-center font-mono">
                    ×
                  </span>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border-subtle)] mb-4 text-[10px] font-medium text-[var(--muted-foreground)]">
                  <button 
                    onClick={() => setActiveTab("CRM")}
                    className={`px-3 py-1.5 border-b-2 cursor-pointer transition-all duration-150 ${
                      activeTab === "CRM" 
                        ? "text-[var(--foreground)] border-[var(--primary)]" 
                        : "border-transparent hover:text-[var(--foreground)]"
                    }`}
                  >
                    CRM
                  </button>
                  <button 
                    onClick={() => setActiveTab("Intelligence")}
                    className={`px-3 py-1.5 border-b-2 cursor-pointer transition-all duration-150 ${
                      activeTab === "Intelligence" 
                        ? "text-[var(--foreground)] border-[var(--primary)]" 
                        : "border-transparent hover:text-[var(--foreground)]"
                    }`}
                  >
                    Intelligence
                  </button>
                </div>

                <div className="flex-grow overflow-hidden relative">
                  <AnimatePresence mode="wait">
                    {activeTab === "Intelligence" ? (
                      <motion.div
                        key="intelligence"
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4 h-full overflow-y-auto pr-1 text-left"
                      >
                        {/* Lead Priority Score */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${MOCK_COMPANIES[selectedCompanyIdx].typeStyle}`}>
                              {MOCK_COMPANIES[selectedCompanyIdx].type}
                            </span>
                            <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                          </div>
                          <div className="text-xl font-bold font-mono text-[var(--foreground)] leading-tight">
                            {MOCK_COMPANIES[selectedCompanyIdx].overall}% <span className="text-[10px] font-normal text-[var(--muted-foreground)]">Overall Score</span>
                          </div>
                        </div>

                        {/* Subscores Grid */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-[var(--background)] border border-[var(--border-subtle)] rounded p-1.5">
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Fit</div>
                            <div className="text-[11px] font-bold font-mono text-[var(--foreground)]">
                              {MOCK_COMPANIES[selectedCompanyIdx].fit}
                            </div>
                          </div>
                          <div className="bg-[var(--background)] border border-[var(--border-subtle)] rounded p-1.5">
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Size</div>
                            <div className="text-[11px] font-bold font-mono text-[var(--foreground)]">
                              {MOCK_COMPANIES[selectedCompanyIdx].size}
                            </div>
                          </div>
                          <div className="bg-[var(--background)] border border-[var(--border-subtle)] rounded p-1.5">
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Intent</div>
                            <div className="text-[11px] font-bold font-mono text-[var(--foreground)]">
                              {MOCK_COMPANIES[selectedCompanyIdx].intent}
                            </div>
                          </div>
                          <div className="bg-[var(--background)] border border-[var(--border-subtle)] rounded p-1.5">
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Urgency</div>
                            <div className="text-[11px] font-bold font-mono text-[var(--foreground)]">
                              {MOCK_COMPANIES[selectedCompanyIdx].urgency}
                            </div>
                          </div>
                        </div>

                        {/* Score Explanations */}
                        <div className="bg-[var(--background)] border border-[var(--border-subtle)] rounded p-2 text-[9px]">
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono mb-1">Score Explanations</div>
                          <div className="text-[var(--success)] font-medium">
                            {MOCK_COMPANIES[selectedCompanyIdx].overall >= 70 ? "+25: Multiple decision makers verified." : "+15: At least one decision-maker found."}
                          </div>
                        </div>

                        {/* AI Lead Intelligence */}
                        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
                          <div className="flex items-center gap-1 text-[9px] uppercase font-mono text-[var(--muted-foreground)]">
                            <svg className="h-3 w-3 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2L2 22h20L12 2z" />
                            </svg>
                            AI Lead Intelligence
                          </div>

                          <div>
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Company Summary</div>
                            <p className="text-[9px] leading-relaxed text-[var(--muted-foreground)] mt-0.5">
                              {MOCK_COMPANIES[selectedCompanyIdx].summary}
                            </p>
                          </div>

                          <div>
                            <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Outreach Angle</div>
                            <p className="text-[9px] italic leading-relaxed text-[var(--foreground)] bg-[var(--background)] border border-[var(--border-subtle)] rounded p-2 mt-0.5">
                              {MOCK_COMPANIES[selectedCompanyIdx].angle}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="crm"
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4 h-full overflow-y-auto pr-1 text-left"
                      >
                        {/* CRM details */}
                        <div>
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Company Name</div>
                          <div className="text-xs font-semibold text-[var(--foreground)] mt-0.5">
                            {MOCK_COMPANIES[selectedCompanyIdx].name}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Phone Number</div>
                          <div className="text-xs text-[var(--foreground)] mt-0.5 font-mono">
                            {MOCK_COMPANIES[selectedCompanyIdx].phone}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Office Location</div>
                          <div className="text-xs text-[var(--foreground)] mt-0.5">
                            {MOCK_COMPANIES[selectedCompanyIdx].location}
                          </div>
                        </div>

                        <div>
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Verified Contacts</div>
                          <div className="text-xs text-[var(--foreground)] mt-0.5 flex items-center gap-1.5 font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]"></span>
                            {MOCK_COMPANIES[selectedCompanyIdx].emails}
                          </div>
                        </div>

                        <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2 select-none">
                          <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">CRM Actions</div>
                          <div className="grid grid-cols-2 gap-1.5 text-[9px] font-semibold text-[var(--muted-foreground)]">
                            <button className="h-7 rounded border border-[var(--border-subtle)] bg-[var(--background)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer">
                              Edit Details
                            </button>
                            <button className="h-7 rounded border border-[var(--border-subtle)] bg-[var(--background)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer">
                              Add Note
                            </button>
                            <button className="h-7 rounded border border-[var(--border-subtle)] bg-[var(--background)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer">
                              Log Activity
                            </button>
                            <button className="h-7 rounded border border-[var(--border-subtle)] bg-[var(--background)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer">
                              Send Email
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
