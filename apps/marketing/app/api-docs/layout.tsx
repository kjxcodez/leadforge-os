import { Metadata } from "next"

export const metadata: Metadata = {
  title: "API & Integrations Reference",
  description: "Direct SQLite query schemas and Node.js code snippets to query LeadForge local database structures.",
  openGraph: {
    title: "API & Integrations Reference | LeadForge OS",
    description: "Direct SQLite query schemas and Node.js code snippets to query LeadForge local database structures.",
    url: "https://github.com/kjxcodez/leadforge-os/api-docs"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
