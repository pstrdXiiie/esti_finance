"use client"

import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { loansComponent } from "@/components/ui/personnel/loans/loans"
import StatutoryReportsPage from "@/app/(app)/personnel/statutory-reports/page"
import { EmployeesList } from "@/components/ui/personnel/employees/EmployeesList"
import { personnel_maintenance } from "@/components/ui/personnel/maintenance/maintenance"
import { PersonnelApprovals } from "@/components/ui/personnel/approvals/approvals"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const TAB_TRIGGER_CLASS =
  "text-foreground hover:text-foreground data-active:bg-primary data-active:text-primary-foreground pt-2 pb-2 rounded-2xl"

const SCREENS = [
  {
    href: "/personnel/policies",
    title: "Policies",
    description: "Named leave/benefit policies referenced by group policy assignments.",
  },
  {
    href: "/personnel/group-policies",
    title: "Group Policies",
    description: "Maps an employment status to the policy that applies to it.",
  },
  {
    href: "/personnel/benefits",
    title: "Employee Benefits",
    description: "Petty-cash-funded employee benefits, submitted against a fund balance.",
  },
  {
    href: "/personnel/loan-types",
    title: "Loan Types",
    description: "Loan codes and interest rates offered to employees (government or in-house).",
  },
  {
    href: "/personnel/loan-applications",
    title: "Loan Applications",
    description: "Employee loan requests: compute terms, route for approval, convert to a loan.",
  },
  {
    href: "/personnel/loans",
    title: "Employee Loans",
    description: "Active employee loans — record payments and track the running balance.",
  },
  {
    href: "/personnel/travel-orders",
    title: "Travel Orders",
    description: "Employee travel requests, submitted for approval per trip.",
  },
  {
    href: "/personnel/overtime",
    title: "Overtime",
    description: "Employee overtime filings with computed hours, submitted for approval.",
  },
  {
    href: "/personnel/statutory-reports",
    title: "Statutory Reports",
    description: "SSS, PhilHealth, and withholding tax report batches.",
  },
]

export default function PersonnelPage() {
  return (
    <div className="grid gap-4">
      <Tabs defaultValue="employees" className="h-full">
        <TabsList className="grid w-full grid-cols-5 h-full gap-2 border-0 bg-sidebar p-1 h-full! rounded-3xl items-center print:hidden">
          <TabsTrigger value="employees" className={TAB_TRIGGER_CLASS}>Employees</TabsTrigger>
          <TabsTrigger value="loans" className={TAB_TRIGGER_CLASS}>Employees Account</TabsTrigger>
          <TabsTrigger value="statutory-reports" className={TAB_TRIGGER_CLASS}>Statutory Reports</TabsTrigger>
          <TabsTrigger value="approvals" className={TAB_TRIGGER_CLASS}>Approvals</TabsTrigger>
          <TabsTrigger value="maintenance" className={TAB_TRIGGER_CLASS}>Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="min-w-0">
          <Tabs
            defaultValue="employees-list"
            orientation="vertical"
            className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border"
          >
            <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
              <TabsTrigger
                value="employees-list"
                className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
              >
                Employees Details
              </TabsTrigger>
              <TabsTrigger
                value="employees-schedule"
                className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
              >
                Schedule
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
              >
                Reports
              </TabsTrigger>
              <TabsTrigger
                value="violation-form"
                className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
              >
                Violation Form
              </TabsTrigger>
            </TabsList>
            <TabsContent value="employees-list" className="mt-0 min-w-0 flex-1">
              <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                <EmployeesList basePath="/personnel/employees" />
              </div>
            </TabsContent>
            <TabsContent value="employees-schedule" className="mt-0 min-w-0 flex-1">
              <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                <div className="rounded-2xl border border-border h-full p-7">
                  <p className="text-muted-foreground">Employee schedule — coming soon.</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="reports" className="mt-0 min-w-0 flex-1">
              <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                <div className="rounded-2xl border border-border h-full p-7">
                  <p className="text-muted-foreground">Reports — coming soon.</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="violation-form" className="mt-0 min-w-0 flex-1">
              <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                <div className="rounded-2xl border border-border h-full p-7">
                  <p className="text-muted-foreground">Violation Form — coming soon.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="loans" className="min-w-0">
          {loansComponent()}
        </TabsContent>
        <TabsContent value="statutory-reports" className="min-w-0">
          <StatutoryReportsPage />
        </TabsContent>
        <TabsContent value="approvals" className="min-w-0">
          <PersonnelApprovals />
        </TabsContent>
        <TabsContent value="maintenance" className="min-w-0">
          {personnel_maintenance()}
        </TabsContent>
      </Tabs>

      <div>
        <h1 className="text-2xl font-semibold">Personnel</h1>
        <p className="text-muted-foreground">
          Policies, employee benefits, loans, travel orders, overtime, and statutory reports.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </div>
  )
}