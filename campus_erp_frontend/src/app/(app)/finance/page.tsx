"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import finance_maintenance from "@/components/ui/finance/maintenance/maintenance";
import finance_transactions from "@/components/ui/finance/transactions/transactions";
import finance_financialreport from "@/components/ui/finance/financialreport/financialreport";
import ChartOfAccountsListPage from "@/app/(app)/finance/chartsofaccounts/page"

const SCREENS = [
  {
    href: "/finance/assessments",
    title: "Student Assessments",
    description: "Review, edit, and submit student fee assessments before payments can be recorded against them.",
  },
  {
    href: "/finance/discounts",
    title: "Discounts",
    description: "Tuition and misc-fee discount codes applied at assessment time.",
  },
  {
    href: "/finance/wallets",
    title: "Student Wallets",
    description: "Look up a student's e-cash wallet balance and record top-ups or payments.",
  },
]

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
          {finance_financialreport()}
        </TabsContent>
        <TabsContent value="maintenance">
          {finance_maintenance()}
        </TabsContent>
      </Tabs>

      {/* <div className="print:hidden">
        <h1 className="text-2xl font-semibold">Finance</h1>
        <p className="text-muted-foreground">
          Student assessments, discounts, wallets, and other finance shortcuts.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
        {SCREENS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div> */}
    </div>
  )
}
