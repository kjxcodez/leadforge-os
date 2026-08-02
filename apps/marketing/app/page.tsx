"use client"

import React from "react"
import { motion } from "motion/react"
import { Hero } from "@/components/Hero"
import { Philosophy } from "@/components/Philosophy"
import { Architecture } from "@/components/Architecture"
import { Downloads } from "@/components/Downloads"
import { Roadmap } from "@/components/Roadmap"
import { FAQ } from "@/components/FAQ"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05
    }
  }
} as const

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const
    }
  }
} as const

export default function Page() {
  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative flex flex-col"
    >
      <motion.div variants={sectionVariants}>
        <Hero />
      </motion.div>
      <motion.div variants={sectionVariants}>
        <Philosophy />
      </motion.div>
      <motion.div variants={sectionVariants}>
        <Architecture />
      </motion.div>
      <motion.div variants={sectionVariants}>
        <Downloads />
      </motion.div>
      <motion.div variants={sectionVariants}>
        <Roadmap />
      </motion.div>
      <motion.div variants={sectionVariants}>
        <FAQ />
      </motion.div>
    </motion.div>
  )
}

