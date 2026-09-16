"use client"

import { use } from "react"
import { FinanceEntryScreen } from "@/components/finance/FinanceEntryScreen"
import { cashReceipt } from "@/lib/forms/finance"

const BASE_PATH = "/finance/transactions/payments_cash_entry"

export default function CashReceiptEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return <FinanceEntryScreen spec={cashReceipt} name={docName} basePath={BASE_PATH} />
}
