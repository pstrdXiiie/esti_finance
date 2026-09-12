"use client"
import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { chartOfAccountSpec } from "@/lib/forms/finance"

export default function ChartOfAccountsListPage() {
  return <FinanceEntryListScreen spec={chartOfAccountSpec} />
}
