"use client"
import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { sundryacc } from "@/lib/forms/finance"

export default function SundryAccountListPage() {
  return <FinanceEntryListScreen spec={sundryacc} />
}
