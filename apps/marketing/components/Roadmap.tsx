"use client"

import React, { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

export function Roadmap() {
  const timelineRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Scroll linked timeline height animation
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 70%", "end 70%"],
  })

  // Connect scaleY to scroll progress
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

  const roadmapItems = [
    {
      title: "Job scheduler & sandboxed workers",
      status: "Shipped",
      statusType: "shipped",
      desc: "Heartbeat monitoring, checkpointed pauses, and automatic retry with exponential backoff.",
    },
    {
      title: "Local-first sync engine",
      status: "Shipped",
      statusType: "shipped",
      desc: "Last-write-wins conflict resolution with a dead-letter queue for failed pushes.",
    },
    {
      title: "Local RAG / vector search",
      status: "In progress",
      statusType: "progress",
      desc: "sqlite-vec-backed local retrieval for grounding AI qualification in your own workspace history.",
    },
    {
      title: "Email verification providers",
      status: "In progress",
      statusType: "progress",
      desc: "Adapter interfaces are in place; concrete verification providers are being wired in next.",
    },
    {
      title: "macOS & Linux installers",
      status: "In progress",
      statusType: "progress",
      desc: "Auto-updater already supports signed Windows releases; native .dmg and .AppImage packaging is underway.",
    },
  ]

  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.35, ease: "easeOut" as const }
    }
  } as const

  return (
    <section id="roadmap" className="py-24 border-t border-[var(--border-subtle)] bg-[var(--background)]">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"></span>
            Roadmap
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:text-4xl">
            Where things stand
          </h2>
          <p className="text-[var(--muted-foreground)] leading-relaxed text-sm md:text-base">
            Pulled directly from our internal build status — not a wishlist.
          </p>
        </div>

        {/* Timeline Layout */}
        <div ref={timelineRef} className="relative max-w-2xl pl-1 select-none">
          {/* Connector Line Background */}
          <div className="absolute left-[5px] top-1.5 bottom-1.5 w-[1px] bg-[var(--border-default)]" />

          {/* Animated Scroll Connected Connector Line (disabled under prefers-reduced-motion) */}
          {!prefersReducedMotion && (
            <motion.div 
              style={{ scaleY, transformOrigin: "top" }}
              className="absolute left-[5px] top-1.5 bottom-1.5 w-[1px] bg-[var(--primary)]"
            />
          )}

          {/* Timeline Items */}
          <div className="flex flex-col">
            {roadmapItems.map((item, idx) => {
              const isShipped = item.statusType === "shipped"

              return (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  initial={prefersReducedMotion ? "visible" : "hidden"}
                  whileInView="visible"
                  viewport={{ once: true, margin: "-100px" }}
                  className="relative pl-8 pb-9 last:pb-0"
                >
                  {/* Timeline Dot Indicator */}
                  <span className={`absolute left-0 top-[3px] z-10 h-3 w-3 rounded-full border-2 bg-[var(--card)] transition-colors duration-300 ${
                    isShipped 
                      ? "border-[var(--success)] bg-[var(--success)]" 
                      : "border-[var(--primary)]"
                  }`} />

                  {/* Item Content Card */}
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-1.5">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">
                        {item.title}
                      </h4>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-mono font-medium ${
                        isShipped 
                          ? "bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]" 
                          : "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--muted-foreground)] max-w-xl">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}
