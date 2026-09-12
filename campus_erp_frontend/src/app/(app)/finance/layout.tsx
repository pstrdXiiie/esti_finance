import type { ReactNode } from "react"

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <main className="flex-1 bg-zinc-50/50 p-6">{children}</main>
}
