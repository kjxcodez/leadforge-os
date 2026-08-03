import { Metadata } from "next"

export const metadata: Metadata = {
  title: "System Changelog",
  description: "Chronological updates, feature additions, fixes, and release timeline for LeadForge OS desktop.",
  openGraph: {
    title: "System Changelog | LeadForge OS",
    description: "Chronological updates, feature additions, fixes, and release timeline for LeadForge OS desktop.",
    url: "https://github.com/kjxcodez/leadforge-os/changelog"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
