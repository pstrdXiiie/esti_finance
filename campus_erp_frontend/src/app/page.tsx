"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/providers/AuthProvider"

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    // Student-only accounts land in the portal shell; staff land in (app).
    const isStudentOnly =
      user.roles.includes("SMS Student") && !user.modules.length
    router.replace(isStudentOnly ? "/portal/dashboard" : "/dashboard")
  }, [loading, user, router])

  return null
}
