"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { studentAccountSpec } from "@/lib/forms/finance"

function StudentAccountsListPageInner() {
  const searchParams = useSearchParams()
  return (
    <FinanceEntryListScreen
      spec={studentAccountSpec}
      formDisplay="inline"
      allowCreate={false}
      initialSearch={searchParams.get("q") ?? undefined}
    />
  )
}

export default function StudentAccountsListPage() {
  return (
    <Suspense fallback={null}>
      <StudentAccountsListPageInner />
    </Suspense>
  )
}
