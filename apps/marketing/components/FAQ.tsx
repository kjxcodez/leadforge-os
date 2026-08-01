"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

interface FAQItemProps {
  question: string
  answer: string
  prefersReducedMotion: boolean
}

function FAQItem({ question, answer, prefersReducedMotion }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-[var(--border-subtle)] first:border-t">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-6 text-left text-sm font-medium text-[var(--foreground)] hover:text-[var(--foreground)] select-none cursor-pointer"
      >
        <span>{question}</span>
        
        {/* Precise Plus/Minus Morphing Icon */}
        <span className="relative h-4 w-4 shrink-0 text-[var(--text-tertiary)] flex items-center justify-center">
          <span className="absolute h-[1.5px] w-3 bg-currentColor" />
          <motion.span 
            className="absolute h-3 w-[1.5px] bg-currentColor"
            animate={{ rotate: isOpen ? 90 : 0, scaleY: isOpen ? 0 : 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? { height: 0, opacity: 0 } : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)] pb-6 max-w-2xl">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FAQ() {
  const prefersReducedMotion = usePrefersReducedMotion()

  const faqData = [
    {
      question: "Where does my lead data actually live?",
      answer: "In a SQLite database on your machine, isolated per workspace. The cloud only receives what the sync engine pushes in the background — it's a backup and collaboration layer, not the primary store.",
    },
    {
      question: "Does LeadForge OS work offline?",
      answer: "Yes. Discovery, crawling, scoring, and campaign editing all run against your local database. Sending email and polling for replies need a connection; everything else keeps working without one.",
    },
    {
      question: "How are my SMTP and LinkedIn credentials stored?",
      answer: "Through your operating system's own keychain, using Electron's safeStorage encryption. Nothing is held in plaintext, and nothing is uploaded to a third-party server to run a campaign.",
    },
    {
      question: "Can I migrate away from Apollo, Instantly, or Lemlist?",
      answer: "You can import existing contact lists directly into a workspace. There's no lock-in on our end — your data lives in a local SQLite file you can read, export, or move at any time.",
    },
    {
      question: "How is LeadForge priced?",
      answer: "You're paying for the software, not per-seat cloud infrastructure to run scraping and crawling — because that work happens on your own hardware instead of ours.",
    },
  ]

  return (
    <section id="faq" className="py-24 border-t border-[var(--border-subtle)] bg-[var(--background)]">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"></span>
            FAQ
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:text-4xl">
            Questions worth asking
          </h2>
        </div>

        {/* FAQ List */}
        <div className="max-w-2xl">
          {faqData.map((item, idx) => (
            <FAQItem
              key={idx}
              question={item.question}
              answer={item.answer}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>

      </div>
    </section>
  )
}
