import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Get in Touch",
  description: "Contact the LeadForge OS support team for sales queries, bug reporting, or custom integrations.",
  openGraph: {
    title: "Get in Touch | LeadForge OS",
    description: "Contact the LeadForge OS support team for sales queries, bug reporting, or custom integrations.",
    url: "https://github.com/kjxcodez/leadforge-os/contact"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
