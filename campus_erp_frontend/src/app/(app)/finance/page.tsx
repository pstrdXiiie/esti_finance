"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import finance_maintenance from "@/components/ui/finance/maintenance/maintenance";
import finance_transactions from "@/components/ui/finance/transactions/transactions";
import ChartOfAccountsListPage from "@/app/(app)/finance/chartsofaccounts/page"
import FinancialReportPage from "@/app/(app)/finance/financialreport/page"

export default function FinancePage() {
  return (
    <Suspense fallback={null}>
      <FinancePageContent />
    </Suspense>
  )
}

function FinancePageContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") ?? "enrollment"
  const initialSubTab = searchParams.get("sub") ?? undefined
  const initialStudentName = searchParams.get("student") ?? undefined

  return (
    <div className="grid gap-4">
      <Tabs defaultValue={initialTab} className="h-full">
        <TabsList className="grid w-full grid-cols-4 h-full gap-2 border-0 bg-sidebar p-1 h-full! rounded-3xl items-center print:hidden">
          <TabsTrigger value="enrollment" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Charts of Accounts
          </TabsTrigger>
          <TabsTrigger value="grades" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Transactions
          </TabsTrigger>
          <TabsTrigger value="classes" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Financial Reports
          </TabsTrigger>
          <TabsTrigger  value="maintenance" className="text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl">
            Maintenance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="enrollment">
          <ChartOfAccountsListPage />
        </TabsContent>
        <TabsContent value="grades" className="min-w-0">
          {finance_transactions({ initialSubTab, initialStudentName })}
        </TabsContent>
        <TabsContent value="classes" className="min-w-0">
          <FinancialReportPage />
        </TabsContent>
        <TabsContent value="maintenance">
          {finance_maintenance()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
