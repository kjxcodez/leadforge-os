"use client"

import React from "react"
import { Navbar } from "@/components/Navbar"
import { Hero } from "@/components/Hero"
import { Philosophy } from "@/components/Philosophy"
import { Architecture } from "@/components/Architecture"
import { Downloads } from "@/components/Downloads"
import { Roadmap } from "@/components/Roadmap"
import { FAQ } from "@/components/FAQ"
import { Footer } from "@/components/Footer"

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent-muted)] selection:text-[var(--foreground)]">
      <Navbar />
      <main className="relative flex flex-col">
        <Hero />
        <Philosophy />
        <Architecture />
        <Downloads />
        <Roadmap />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}

