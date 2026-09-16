"use client"

import { use } from "react"
import { FinanceEntryScreen } from "@/components/finance/FinanceEntryScreen"
import { studentAccountSpec } from "@/lib/forms/finance"

const BASE_PATH = "/finance/transactions/student_acc"

export default function StudentAccountEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <FinanceEntryScreen spec={studentAccountSpec} name={docName} basePath={BASE_PATH} />
    </div>
  )
}