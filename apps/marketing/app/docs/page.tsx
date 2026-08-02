"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Book, Terminal, Settings, Cpu, Compass, Search, ChevronRight, FileText, ShieldAlert, AlertTriangle, Info, Check, Copy, ExternalLink, ArrowLeft, ArrowRight, CornerDownLeft, Eye, Clock, Edit3 } from "lucide-react"
import { GENERATED_DOCS, DocArticle } from "../../lib/generated-docs"
import Link from "next/link"

export default function DocsPage() {
  const [activeArticleId, setActiveArticleId] = useState<string>("installation")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeHeadingId, setActiveHeadingId] = useState<string>("")
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Groups and categories structure
  const categories = useMemo(() => {
    const groups: Record<string, DocArticle[]> = {
      "Getting Started": [],
      "Architecture": [],
      "Core Mechanics": [],
      "Security": [],
      "Development": [],
      "Diagnostics": [],
      "ADRs": []
    }

    // Sort ADRs numerically, others by natural index
    const sortedDocs = [...GENERATED_DOCS].sort((a, b) => {
      if (a.category === "ADRs" && b.category === "ADRs") {
        const numA = parseInt(a.id.replace("adr-", "")) || 0
        const numB = parseInt(b.id.replace("adr-", "")) || 0
        return numA - numB
      }
      return 0
    })

    sortedDocs.forEach(doc => {
      const cat = doc.category
      if (groups[cat]) {
        groups[cat].push(doc)
      } else {
        groups[cat] = [doc]
      }
    })

    return Object.entries(groups).filter(([_, items]) => items.length > 0)
  }, [])

  // Current active article
  const activeArticle = useMemo(() => {
    return GENERATED_DOCS.find(doc => doc.id === activeArticleId) || GENERATED_DOCS[0]
  }, [activeArticleId])

  // Flat list of all articles for next/prev navigation
  const flatArticlesList = useMemo(() => {
    return categories.flatMap(([_, items]) => items)
  }, [categories])

  const currentIndex = flatArticlesList.findIndex(doc => doc.id === activeArticleId)
  const prevArticle = currentIndex > 0 ? flatArticlesList[currentIndex - 1] : null
  const nextArticle = currentIndex < flatArticlesList.length - 1 ? flatArticlesList[currentIndex + 1] : null

  // Hotkeys handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === "Escape") {
        setSearchOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80)
    } else {
      setSearchQuery("")
    }
  }, [searchOpen])

  // Scroll spy to highlight active TOC header
  useEffect(() => {
    const headingElements = activeArticle.headings.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[]
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120
      
      // Find the heading currently in view
      let currentActive: string = ""
      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i]
        if (el.offsetTop <= scrollPosition) {
          currentActive = el.id
        } else {
          break
        }
      }
      setActiveHeadingId(currentActive || (activeArticle.headings[0]?.id || ""))
    }

    window.addEventListener("scroll", handleScroll)
    // Run once on load/change
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [activeArticle])

  // Filter search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    
    return GENERATED_DOCS.filter(doc => {
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q) ||
        doc.htmlContent.toLowerCase().includes(q) ||
        doc.headings.some(h => h.text.toLowerCase().includes(q))
      )
    })
  }, [searchQuery])

  // Trigger scroll-to-view for headings
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const offset = 90
      const bodyRect = document.body.getBoundingClientRect().top
      const elementRect = element.getBoundingClientRect().top
      const elementPosition = elementRect - bodyRect
      const offsetPosition = elementPosition - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      })
      setActiveHeadingId(id)
    }
  }

  // Handle article transition
  const handleArticleSelect = (id: string, headingId?: string) => {
    setActiveArticleId(id)
    setSearchOpen(false)
    window.scrollTo({ top: 0 })
    
    if (headingId) {
      setTimeout(() => scrollToHeading(headingId), 200)
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 min-h-[85vh] text-left">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[220px_1fr_200px] gap-8">
        
        {/* Sidebar Nav */}
        <div className="hidden md:block space-y-6 select-none border-r border-[var(--border-subtle)] pr-6">
          <div className="relative group cursor-pointer" onClick={() => setSearchOpen(true)}>
            <div className="w-full h-8 pl-8 pr-2 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] text-[var(--muted-foreground)] flex items-center justify-between hover:border-[var(--border-strong)] transition-all">
              <span className="truncate">Search docs...</span>
              <kbd className="hidden sm:inline-flex h-4 select-none items-center gap-0.5 rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1 font-mono text-[8px] font-medium opacity-60">
                ⌘/
              </kbd>
            </div>
            <Search className="absolute left-2.5 top-[8px] h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          </div>

          <div className="space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
            {categories.map(([catName, items]) => (
              <div key={catName} className="space-y-1.5">
                <h4 className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                  {catName}
                </h4>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = activeArticleId === item.id
                    const IconComp = item.category === "Security" ? ShieldAlert : item.category === "ADRs" ? FileText : Book
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleArticleSelect(item.id)}
                        className={`flex w-full items-center gap-2 px-2.5 py-1.5 rounded text-[11.5px] font-medium transition-colors duration-150 cursor-pointer ${
                          isActive 
                            ? "bg-[rgba(232,98,44,0.06)] text-[var(--primary)] border-l-2 border-[var(--primary)] pl-[8px]" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Panel */}
        <div className="space-y-8 min-w-0 pr-0 md:pr-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-tertiary)]">
            <span className="hover:text-[var(--foreground)]">Docs</span>
            <ChevronRight className="h-2.5 w-2.5" />
            <span className="hover:text-[var(--foreground)]">{activeArticle.category}</span>
            <ChevronRight className="h-2.5 w-2.5" />
            <span className="text-[var(--foreground)] truncate">{activeArticle.title}</span>
          </div>

          {/* Article Header */}
          <div className="border-b border-[var(--border-subtle)] pb-5 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {activeArticle.title}
            </h1>
            <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-tertiary)] select-none">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {activeArticle.readingTime} min read
              </span>
              <span>•</span>
              <a 
                href={`https://github.com/kjxcodez/leadforge-os/edit/main/docs/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit on GitHub
              </a>
            </div>
          </div>

          {/* Compiled HTML Content */}
          <div 
            ref={contentRef}
            className="doc-content prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: activeArticle.htmlContent }}
          />

          {/* Previous/Next Navigation */}
          <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-subtle)] pt-6 mt-12 select-none">
            {prevArticle ? (
              <button 
                onClick={() => handleArticleSelect(prevArticle.id)}
                className="flex flex-col items-start gap-1 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] hover:border-[var(--border-strong)] text-left cursor-pointer transition-all"
              >
                <span className="text-[9px] font-mono text-[var(--text-tertiary)] flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> PREVIOUS
                </span>
                <span className="text-[11.5px] font-semibold text-[var(--foreground)] truncate w-full">
                  {prevArticle.title}
                </span>
              </button>
            ) : <div />}

            {nextArticle ? (
              <button 
                onClick={() => handleArticleSelect(nextArticle.id)}
                className="flex flex-col items-end gap-1 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--card)] hover:border-[var(--border-strong)] text-right cursor-pointer transition-all"
              >
                <span className="text-[9px] font-mono text-[var(--text-tertiary)] flex items-center gap-1">
                  NEXT <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-[11.5px] font-semibold text-[var(--foreground)] truncate w-full">
                  {nextArticle.title}
                </span>
              </button>
            ) : <div />}
          </div>
        </div>

        {/* Right Table of Contents (Outline) */}
        <div className="hidden lg:block space-y-4 select-none border-l border-[var(--border-subtle)] pl-4">
          {activeArticle.headings.length > 0 && (
            <>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                On this page
              </h4>
              <div className="space-y-1.5 text-[11px] leading-normal font-medium">
                {activeArticle.headings.map((heading) => {
                  const isActive = activeHeadingId === heading.id
                  const indentClass = heading.level === 3 ? "pl-3 text-[10.5px] opacity-80" : ""
                  
                  return (
                    <button
                      key={heading.id}
                      onClick={() => scrollToHeading(heading.id)}
                      className={`block w-full text-left truncate transition-colors duration-150 cursor-pointer ${indentClass} ${
                        isActive 
                          ? "text-[var(--primary)] font-semibold" 
                          : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {heading.text}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Global Search Cockpit Modal */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="relative w-full max-w-lg border border-[var(--border)] rounded-lg bg-[var(--card)] shadow-2xl overflow-hidden"
            >
              {/* Search input bar */}
              <div className="flex h-12 items-center border-b border-[var(--border-subtle)] px-4">
                <Search className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type to search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-full border-0 bg-transparent px-3 text-xs text-[var(--foreground)] focus:ring-0 outline-none placeholder:text-[var(--text-tertiary)]"
                />
                <button 
                  onClick={() => setSearchOpen(false)}
                  className="rounded border border-[var(--border-subtle)] bg-[var(--background)] px-1.5 py-0.5 text-[8px] font-mono text-[var(--text-tertiary)]"
                >
                  ESC
                </button>
              </div>

              {/* Search results ledger */}
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {searchQuery.trim() === "" ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-[10.5px] text-[var(--text-tertiary)]">
                    <Book className="h-6 w-6 opacity-30 mb-2" />
                    <span>Search by document title, code snippets, or parameters.</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleArticleSelect(result.id)}
                      className="w-full flex items-center justify-between p-3 rounded bg-[rgba(10,10,11,0.2)] border border-[var(--border-subtle)] hover:border-[var(--primary)] hover:bg-[rgba(232,98,44,0.02)] transition-all text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-4">
                        <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] block">
                          {result.category}
                        </span>
                        <span className="text-[11.5px] font-semibold text-[var(--foreground)] truncate block mt-0.5">
                          {result.title}
                        </span>
                      </div>
                      <CornerDownLeft className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-[10.5px] text-[var(--text-tertiary)]">
                    <AlertTriangle className="h-6 w-6 opacity-30 mb-2 text-amber-500" />
                    <span>No results found matching "{searchQuery}"</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
