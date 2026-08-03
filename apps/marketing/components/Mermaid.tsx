"use client"

import React, { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

interface MermaidProps {
  chart: string
  isBase64?: boolean
}

export function Mermaid({ chart, isBase64, isbase64 }: any) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isB64 = 
    isBase64 === true || 
    isBase64 === "true" || 
    isbase64 === true || 
    isbase64 === "true"

  useEffect(() => {
    let active = true
    let decodedChart = chart

    if (isB64) {
      try {
        decodedChart = atob(chart)
      } catch (e) {
        console.error("Failed to decode base64 mermaid chart:", e)
        setError("Decoding Error")
        setLoading(false)
        return
      }
    }

    // Dynamic import to prevent next.js SSR errors
    import("mermaid")
      .then((m) => {
        if (!active) return
        const mermaid = m.default

        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          themeVariables: {
            background: "transparent",
            primaryColor: "rgba(232, 98, 44, 0.12)",
            primaryTextColor: "#F4F4F5",
            primaryBorderColor: "rgba(232, 98, 44, 0.3)",
            lineColor: "#E8622C",
            secondaryColor: "#131316",
            tertiaryColor: "#0A0A0B",
            noteBkgColor: "#131316",
            noteBorderColor: "#242426",
            actorBkg: "#131316",
            actorBorder: "#242426"
          }
        })

        const id = `mermaid-svg-${Math.floor(Math.random() * 1000000)}`
        
        mermaid
          .render(id, decodedChart)
          .then(({ svg }) => {
            if (!active) return
            if (containerRef.current) {
              containerRef.current.innerHTML = svg
              
              // Apply basic responsive constraints to svg output
              const svgEl = containerRef.current.querySelector("svg")
              if (svgEl) {
                svgEl.setAttribute("width", "100%")
                svgEl.style.maxWidth = "100%"
                svgEl.style.height = "auto"
                svgEl.style.background = "transparent"
              }
            }
            setLoading(false)
          })
          .catch((err) => {
            if (!active) return
            console.error("Mermaid rendering failed:", err)
            setError("Diagram Render Failure")
            setLoading(false)
          })
      })
      .catch((err) => {
        if (!active) return
        console.error("Failed to import mermaid:", err)
        setError("Module Import Error")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [chart, isBase64])

  return (
    <div className="my-8 border border-[var(--border-subtle)] rounded-lg bg-[rgba(10,10,11,0.4)] p-6 overflow-x-auto custom-scrollbar flex flex-col items-center justify-center min-h-[160px] relative select-none">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--background)] opacity-70 z-10">
          <Loader2 className="h-5 w-5 text-[var(--primary)] animate-spin" />
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">Rendering Outline</span>
        </div>
      )}
      
      {error ? (
        <div className="text-red-500 font-mono text-[10px] bg-red-500/5 p-4 border border-red-500/20 rounded max-w-md text-center">
          <div className="font-semibold uppercase tracking-wider mb-1">{error}</div>
          <span className="text-zinc-500">Double check chart syntax, nodes relationships, or closed arrows definitions.</span>
        </div>
      ) : (
        <div ref={containerRef} className="w-full overflow-hidden flex items-center justify-center" />
      )}
    </div>
  )
}
