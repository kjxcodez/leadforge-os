"use client"

import React from "react"
import { Hero } from "@/components/Hero"
import { Philosophy } from "@/components/Philosophy"
import { Architecture } from "@/components/Architecture"
import { Downloads } from "@/components/Downloads"
import { Roadmap } from "@/components/Roadmap"
import { FAQ } from "@/components/FAQ"

export default function Page() {
  return (
    <div className="relative flex flex-col">
      <Hero />
      <Philosophy />
      <Architecture />
      <Downloads />
      <Roadmap />
      <FAQ />
    </div>
  )
}

