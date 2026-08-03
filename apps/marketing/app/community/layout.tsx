import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Operator Community",
  description: "Find official GitHub discussions, Discord channels, and community resources to contribute to LeadForge OS.",
  openGraph: {
    title: "Operator Community | LeadForge OS",
    description: "Find official GitHub discussions, Discord channels, and community resources to contribute to LeadForge OS.",
    url: "https://github.com/kjxcodez/leadforge-os/community"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
