"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"

export default function PurchaseOrdersListPage() {
  return <EntryListScreen spec={purchaseOrderSpec} basePath="/finance/purchase-orders" inlineAdd />
}