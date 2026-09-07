"use client"

import { type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// Separate layout/shell from (app) — mirrors the legacy system's own split
// between the staff MDI shell and the Students/ folder's own login+MDI shell
// (blueprint §5.5).
export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/login")
    return null
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Student Portal</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user.full_name}
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign Out
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
