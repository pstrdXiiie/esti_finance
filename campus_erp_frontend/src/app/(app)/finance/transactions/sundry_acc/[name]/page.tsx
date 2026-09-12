"use client"

import { use } from "react"
import { FinanceEntryScreen } from "@/components/finance/FinanceEntryScreen"
import { sundryacc } from "@/lib/forms/finance"

const BASE_PATH = "/finance/transactions/sundry_acc"

export default function SundryAccountEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return <FinanceEntryScreen spec={sundryacc} name={docName} basePath={BASE_PATH} />
}
