import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Local-First Architecture",
  description: "Technical outline of LeadForge OS multithreaded Chromium scrapers, Ollama LLM integration, and SQLite WAL database architecture.",
  openGraph: {
    title: "Local-First Architecture | LeadForge OS",
    description: "Technical outline of LeadForge OS multithreaded Chromium scrapers, Ollama LLM integration, and SQLite WAL database architecture.",
    url: "https://github.com/kjxcodez/leadforge-os/architecture"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
