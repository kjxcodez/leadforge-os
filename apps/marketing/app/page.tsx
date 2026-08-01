"use client"

import React from "react"
import { Navbar } from "@/components/Navbar"
import { Hero } from "@/components/Hero"

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent-muted)] selection:text-[var(--foreground)]">
      <Navbar />
      <main className="relative flex flex-col">
        <Hero />
      </main>
    </div>
  )
}

