"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { studentSpec } from "@/lib/forms/registrar"

function StudentsPageInner() {
  const searchParams = useSearchParams()
  return <MasterDetailScreen spec={studentSpec} initialSearch={searchParams.get("q") ?? undefined} />
}

export default function StudentsPage() {
  return (
    <Suspense fallback={null}>
      <StudentsPageInner />
    </Suspense>
  )
}
