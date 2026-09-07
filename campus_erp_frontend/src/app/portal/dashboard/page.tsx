"use client"

import { useAuth } from "@/providers/AuthProvider"

export default function PortalDashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome, {user?.full_name}</h1>
      <p className="text-muted-foreground">
        Subjects, billing, and grades land here once the Registrar module&apos;s
        self-service screens are implemented (blueprint §2, Registrar —
        Enrollment).
      </p>
    </div>
  )
}
