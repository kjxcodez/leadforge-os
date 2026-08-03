import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Brand Guidelines & Logo Marks",
  description: "Download official LeadForge OS logo marks, app icons, color palettes, and branding assets.",
  openGraph: {
    title: "Brand Guidelines & Logo Marks | LeadForge OS",
    description: "Download official LeadForge OS logo marks, app icons, color palettes, and branding assets.",
    url: "https://github.com/kjxcodez/leadforge-os/brand"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
