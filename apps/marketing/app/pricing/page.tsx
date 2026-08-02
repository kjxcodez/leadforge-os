"use client"

import React, { useState } from "react"
import { motion } from "motion/react"
import { Check, ShieldAlert, Zap, Globe, Cpu } from "lucide-react"

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly")

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

  const tiers = [
    {
      name: "Free (Local-Only)",
      price: 0,
      description: "Run the full LeadForge OS suite on your desktop, with data stored strictly inside your local files.",
      features: [
        "Google Maps scraper",
        "Email enrichment workers",
        "Direct SMTP campaigns",
        "Local SQLite WAL storage",
        "Community support"
      ]
    },
    {
      name: "Pro (Hybrid Cloud)",
      price: billingCycle === "yearly" ? 49 : 59,
      description: "Keep your local-first client synced with cloud backup backups and remote SMTP relays.",
      features: [
        "Everything in Free",
        "Encrypted Cloud Backups",
        "Remote dispatch sync engine",
        "Lead scoring formulas",
        "AI outreach suggestions",
        "Email/Discord support"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "Deploy LeadForge relayer nodes across custom dedicated servers with security logs.",
      features: [
        "Everything in Pro",
        "Self-hosted sync engine",
        "Custom API configurations",
        "Team workspace collaboration",
        "Priority 24/7 support SLAs",
        "Compliance documentation"
      ]
    }
  ]

  return (
    <div className="container mx-auto px-6 py-20 min-h-[85vh] text-left">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto space-y-16"
      >
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <motion.div variants={childVariants} className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase tracking-wider font-mono">
              Pricing Options
            </motion.div>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
              Pay for the system, not seats.
            </h1>
            <p className="text-base text-[var(--text-secondary)]">
              LeadForge OS runs on your hardware, which means we do not charge bloated cloud hosting markups.
            </p>
          </div>

          {/* Toggle Button */}
          <motion.div variants={childVariants} className="flex p-0.5 rounded bg-[var(--card)] border border-[var(--border)] shrink-0 select-none">
            <button 
              onClick={() => setBillingCycle("monthly")}
              className={`h-7 px-3 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                billingCycle === "monthly" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle("yearly")}
              className={`h-7 px-3 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                billingCycle === "yearly" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              Yearly (Save 20%)
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards Grid */}
        <motion.div variants={childVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div 
              key={tier.name}
              className={`border rounded-lg p-6 bg-[var(--card)] space-y-6 flex flex-col justify-between ${
                tier.popular ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-[var(--border)]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{tier.name}</h3>
                  {tier.popular && (
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--primary)] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                      Popular
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold font-mono text-[var(--foreground)]">
                  {typeof tier.price === "number" ? (
                    <>
                      ${tier.price}
                      <span className="text-xs font-normal text-[var(--text-tertiary)]">/mo</span>
                    </>
                  ) : (
                    tier.price
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {tier.description}
                </p>
              </div>

              <div className="space-y-4">
                <ul className="space-y-2 border-t border-[var(--border-subtle)] pt-4 text-[11px] text-[var(--text-secondary)]">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  className={`w-full h-9 rounded text-xs font-semibold transition-all cursor-pointer ${
                    tier.popular 
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90" 
                      : "border border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {tier.price === 0 ? "Get Started" : tier.price === "Custom" ? "Contact Sales" : "Subscribe"}
                </button>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Local Security block */}
        <motion.div variants={childVariants} className="border border-[var(--border)] rounded-xl bg-[var(--card)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
              <ShieldAlert className="h-4.5 w-4.5 text-[var(--primary)]" />
              Cancel or Switch Anytime
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Subscribing supports LeadForge development. If you decide to cancel, your database remains 100% readable locally on your machine forever.
            </p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  )
}
