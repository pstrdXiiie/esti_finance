"use client"
import { FinanceMaintenanceScreen } from "@/components/finance/FinanceMaintenanceScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"

export default function PurchaseOrdersListPage() {
  return <FinanceMaintenanceScreen spec={purchaseOrderSpec} />
}
