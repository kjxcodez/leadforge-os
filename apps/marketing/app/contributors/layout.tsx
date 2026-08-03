import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contributors Repository",
  description: "Credits to the developers, open-source maintainers, and documentation writers of the LeadForge outbound engine.",
  openGraph: {
    title: "Contributors Repository | LeadForge OS",
    description: "Credits to the developers, open-source maintainers, and documentation writers of the LeadForge outbound engine.",
    url: "https://github.com/kjxcodez/leadforge-os/contributors"
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
