"use client"
import { FinanceMaintenanceScreen } from "@/components/finance/FinanceMaintenanceScreen"
import { sundryacc } from "@/lib/forms/finance"

export default function SundryAccountListPage() {
  return <FinanceMaintenanceScreen spec={sundryacc} />
}
