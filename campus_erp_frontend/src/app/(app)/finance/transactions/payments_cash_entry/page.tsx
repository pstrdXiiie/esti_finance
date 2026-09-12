"use client"
import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { cashReceipt } from "@/lib/forms/finance"

export default function CashReceiptListPage() {
  return <FinanceEntryListScreen spec={cashReceipt} />
}
