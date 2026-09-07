import Link from "next/link"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
