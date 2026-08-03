import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Manifesto & About",
  description: "Learn about the local-first B2B outbound manifesto and data compliance philosophy behind LeadForge OS.",
  openGraph: {
    title: "Manifesto & About | LeadForge OS",
    description: "Learn about the local-first B2B outbound manifesto and data compliance philosophy behind LeadForge OS.",
    url: "https://github.com/kjxcodez/leadforge-os/about"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
