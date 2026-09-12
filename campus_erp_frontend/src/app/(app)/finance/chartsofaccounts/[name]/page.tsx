"use client"

import { use } from "react"
import { FinanceEntryScreen } from "@/components/finance/FinanceEntryScreen"
import { chartOfAccountSpec } from "@/lib/forms/finance"

const BASE_PATH = "/finance/chartsofaccounts"

export default function ChartOfAccountEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return <FinanceEntryScreen spec={chartOfAccountSpec} name={docName} basePath={BASE_PATH} />
}
