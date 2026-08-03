import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Download LeadForge OS",
  description: "Get the latest production-ready desktop installer package for LeadForge OS on Windows and other platforms.",
  openGraph: {
    title: "Download LeadForge OS | LeadForge OS",
    description: "Get the latest production-ready desktop installer package for LeadForge OS on Windows and other platforms.",
    url: "https://github.com/kjxcodez/leadforge-os/download"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
