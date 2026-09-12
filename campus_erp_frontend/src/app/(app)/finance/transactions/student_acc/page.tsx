"use client"
import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { studentAccountSpec } from "@/lib/forms/finance"

export default function StudentAccountsListPage() {
  return <FinanceEntryListScreen spec={studentAccountSpec} />
}