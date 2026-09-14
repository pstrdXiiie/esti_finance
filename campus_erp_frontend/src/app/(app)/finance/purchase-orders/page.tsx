"use client"
<<<<<<< HEAD
import { FinanceMaintenanceScreen } from "@/components/finance/FinanceMaintenanceScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"

export default function PurchaseOrdersListPage() {
  return <FinanceMaintenanceScreen spec={purchaseOrderSpec} />
=======

import { FinanceEntryListScreen } from "@/components/finance/FinanceEntryListScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"

export default function PurchaseOrdersListPage() {
  return <FinanceEntryListScreen spec={purchaseOrderSpec} formDisplay="inline" />
>>>>>>> bd92b2d (updated finance maintenance)
}
