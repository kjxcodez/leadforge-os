import { Geist, Geist_Mono, Inter } from "next/font/google"
import { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "LeadForge OS — Open Source Local-First Outbound Engine",
    template: "%s | LeadForge OS"
  },
  description: "Crawl leads locally, enrich contact structures via offline Ollama LLMs, and dispatch outbound sequences directly from SQLite WAL databases. Zero-telemetry, open-source B2B pipelines.",
  keywords: [
    "local-first lead generation",
    "open source outbound engine",
    "SQLite WAL email scraper",
    "headless Google Maps scraper",
    "Ollama contact qualification",
    "private lead enrichment",
    "self-hosted B2B outreach",
    "LeadForge OS",
    "zero telemetry lead generation"
  ],
  authors: [{ name: "kjxcodez", url: "https://github.com/kjxcodez" }],
  creator: "kjxcodez",
  metadataBase: new URL("https://github.com/kjxcodez/leadforge-os"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://github.com/kjxcodez/leadforge-os",
    title: "LeadForge OS — Open Source Local-First Outbound Engine",
    description: "Crawl leads locally, enrich contact structures via offline Ollama LLMs, and dispatch outbound sequences directly from SQLite WAL databases.",
    siteName: "LeadForge OS"
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadForge OS — Open Source Local-First Outbound Engine",
    description: "Crawl leads locally, enrich contact structures via offline Ollama LLMs, and dispatch outbound sequences directly from SQLite WAL databases."
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Structured JSON-LD Data for SEO, AEO, and GEO crawling engines
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "LeadForge OS",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Windows 10, Windows 11, macOS, Linux",
    "license": "https://opensource.org/licenses/MIT",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "creator": {
      "@type": "Person",
      "name": "kjxcodez",
      "url": "https://github.com/kjxcodez"
    },
    "description": "Open-source, local-first outbound operating system that crawls leads, enriches contacts via local Ollama models, and runs sequences directly on local SQLite databases."
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased dark", fontMono.variable, "font-sans", inter.variable)}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[rgba(232,98,44,0.12)] selection:text-[var(--foreground)]">
        <ThemeProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
