"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { Search, CornerDownLeft, Book, AlertTriangle, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"

interface SearchIndexEntry {
  title: string
  description: string
  category: string
  slug: string
  url: string
  headings: string[]
  text: string
}

export function DocsSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([])
  
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Open on shortcut (⌘+K, Ctrl+K, or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Load search index on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
      if (searchIndex.length === 0) {
        fetch("/search-index.json")
          .then((res) => res.json())
          .then((data) => setSearchIndex(data))
          .catch((err) => console.error("Failed to load search index:", err))
      }
    } else {
      setQuery("")
    }
  }, [open, searchIndex])

  // Filter query matches
  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()

    return searchIndex.filter((entry) => {
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.text.toLowerCase().includes(q) ||
        entry.headings.some(h => h.toLowerCase().includes(q))
      )
    })
  }, [query, searchIndex])

  const handleSelect = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <>
      {/* Search Trigger Input Bar */}
      <div 
        onClick={() => setOpen(true)}
        className="relative group cursor-pointer w-full select-none"
      >
        <div className="w-full h-8 pl-8 pr-2 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] text-[var(--muted-foreground)] flex items-center justify-between hover:border-[var(--border-strong)] transition-all">
          <span className="truncate">Search docs...</span>
          <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1.5 font-mono text-[8px] font-medium opacity-60">
            ⌘/
          </kbd>
        </div>
        <Search className="absolute left-2.5 top-[8px] h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      </div>

      {/* Backdrop & Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="relative w-full max-w-lg border border-[var(--border)] rounded-lg bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              {/* Header search bar */}
              <div className="flex h-12 items-center border-b border-[var(--border-subtle)] px-4">
                <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type to search documentation..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-full border-0 bg-transparent px-3 text-xs text-[var(--foreground)] focus:ring-0 outline-none placeholder:text-[var(--text-tertiary)]"
                />
                <button 
                  onClick={() => setOpen(false)}
                  className="rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1.5 py-0.5 text-[8px] font-mono text-[var(--text-tertiary)] hover:text-[var(--foreground)]"
                >
                  ESC
                </button>
              </div>

              {/* List of results */}
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {query.trim() === "" ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-[10.5px] text-[var(--text-tertiary)]">
                    <Book className="h-6 w-6 opacity-30 mb-2 text-[var(--primary)]" />
                    <span>Search by document title, details, or keywords.</span>
                  </div>
                ) : results.length > 0 ? (
                  results.map((entry) => (
                    <button
                      key={entry.slug}
                      onClick={() => handleSelect(entry.url)}
                      className="w-full flex items-center justify-between p-3 rounded bg-[rgba(10,10,11,0.2)] border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[rgba(232,98,44,0.02)] transition-all text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-4">
                        <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
                          {entry.category}
                        </span>
                        <span className="text-[11.5px] font-semibold text-[var(--foreground)] truncate block mt-0.5">
                          {entry.title}
                        </span>
                        {entry.description && (
                          <span className="text-[9.5px] text-[var(--text-secondary)] truncate block mt-0.5">
                            {entry.description}
                          </span>
                        )}
                      </div>
                      <CornerDownLeft className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-[10.5px] text-[var(--text-tertiary)]">
                    <AlertTriangle className="h-6 w-6 opacity-30 mb-2 text-amber-500" />
                    <span>No results found matching "{query}"</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
