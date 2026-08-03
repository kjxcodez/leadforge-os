"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { HelpCircle, ChevronRight, MessageSquare } from "lucide-react"

interface FAQItemProps {
  question: string
  answer: string
  prefersReducedMotion: boolean
}

function FAQItem({ question, answer, prefersReducedMotion }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-[var(--border-subtle)] rounded-lg bg-[rgba(10,10,12,0.4)] backdrop-blur mb-3 overflow-hidden text-left font-mono">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4.5 text-xs font-semibold text-white select-none cursor-pointer hover:bg-[rgba(255,255,255,0.015)] transition-colors"
      >
        <span className="pr-4">{question}</span>
        
        {/* Animated Chevron Indicator */}
        <span className="relative h-4.5 w-4.5 shrink-0 text-[var(--text-tertiary)] flex items-center justify-center border border-[var(--border-subtle)] rounded bg-[rgba(10,10,12,0.6)]">
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <ChevronRight className="h-3 w-3" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? { height: 0, opacity: 0 } : { height: 0, opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-[10px] sm:text-[11px] leading-relaxed text-[var(--text-secondary)] p-4.5 pt-0 border-t border-[var(--border-subtle)] bg-[rgba(5,5,6,0.2)] font-sans">
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
      question: "Where is my campaign and prospect data stored?",
      answer: "Every lead profile, scrap list, and campaign sequence resides inside a secure SQLite database stored locally in your operating system container. No cloud infrastructure parses your raw outbound sequences.",
    },
    {
      question: "Can I manage outbound tasks completely offline?",
      answer: "Yes. Lead discovery, contact enrichment, and local sequence modeling operate natively on your system database without active internet. Network sockets are only opened when sending mail relays or syncing cloud backups.",
    },
    {
      question: "How are sensitive SMTP and service tokens protected?",
      answer: "Tokens and SMTP credentials are encrypted directly through Electron's safeStorage bridge, locking them to your operating system's native keychain (such as Windows Credentials Manager or macOS Keychain).",
    },
    {
      question: "Is there a limit on seat licenses or active campaigns?",
      answer: "No. Since scraping, crawling, and scheduling operations leverage your machine's physical hardware threads instead of our server units, we do not impose seat caps or paywalls on lead database size.",
    },
  ]

  return (
    <section id="faq" className="py-24 border-t border-[var(--border-subtle)] bg-[#09090B] relative overflow-hidden lg:px-32 md:px-20 px-4">
      <div className="container mx-auto px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-12 text-left">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            <MessageSquare className="h-3.5 w-3.5 text-[var(--primary)]" />
            General Q&amp;A
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4 md:text-4xl">
            Questions worth asking
          </h2>
        </div>

        {/* FAQ Accordion List */}
        <div className="max-w-2xl mx-auto">
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
