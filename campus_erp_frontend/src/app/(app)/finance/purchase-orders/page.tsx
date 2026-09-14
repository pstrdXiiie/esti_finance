"use client"

import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"

export default function PurchaseOrdersListPage() {
  return <FinanceEntryListScreen spec={purchaseOrderSpec} formDisplay="inline" />
}
