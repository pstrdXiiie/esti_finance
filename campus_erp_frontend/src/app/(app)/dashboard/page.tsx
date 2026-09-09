"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/providers/AuthProvider"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Banknote,
  ChevronRight,
  GraduationCap,
  Presentation,
  Users,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { frappe } from "@/lib/frappe"

interface PendingApprovalRow {
  doctype: string
  name: string
  status: string
  employee: string
  creation: string
}

interface RecentStudentRow {
  name: string
  student_name: string
  sms_status: string
  branch: string | null
}

const APPROVAL_DETAIL_BASE_PATH: Record<string, string> = {
  "SMS Loan Application": "/personnel/loan-applications",
  "SMS Overtime": "/personnel/overtime",
  "SMS Travel Order": "/personnel/travel-orders",
}

const ChartData = [
  { location: "Odiongan", tourism: 4000, computer_science: 2400, criminology: 2400 },
  { location: "Looc", tourism: 3000, computer_science: 1398, criminology: 2210 },
  { location: "Alcantara", tourism: 2000, computer_science: 9800, criminology: 2290 },
  { location: "Sta. Fe", tourism: 2780, computer_science: 3908, criminology: 2000 },
  { location: "Sta. Maria", tourism: 1890, computer_science: 4800, criminology: 2181 },
  { location: "San Agustin", tourism: 2390, computer_science: 3800, criminology: 2500 },
  { location: "San Andres", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "Romblon", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "San Jose", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "Calatrava", tourism: 3490, computer_science: 4300, criminology: 2100 },
  { location: "Sibuyan", tourism: 3490, computer_science: 4300, criminology: 2100 },
]

const ChartConfig = {
  tourism: { label: "Tourism", color: "var(--chart-1)" },
  computer_science: { label: "Computer Science", color: "var(--chart-2)" },
  criminology: { label: "Criminology", color: "var(--chart-3)" },
} satisfies ChartConfig

const PROGRAM_TOTALS = (
  Object.keys(ChartConfig) as Array<keyof typeof ChartConfig>
).map((key) => ({
  key,
  label: ChartConfig[key].label,
  color: ChartConfig[key].color,
  value: ChartData.reduce((sum, row) => sum + row[key], 0),
}))

const TOTAL_ENROLLEES = PROGRAM_TOTALS.reduce((sum, p) => sum + p.value, 0)

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <span className="font-heading text-3xl font-bold">{value}</span>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const studentCountQuery = useQuery({
    queryKey: ["Student", "count", "active"],
    queryFn: () =>
      frappe.call<number>("frappe.client.get_count", {
        doctype: "Student",
      }),
  })

  const pendingApprovalsQuery = useQuery({
    queryKey: ["administration", "pending-approvals"],
    queryFn: () =>
      frappe.call<PendingApprovalRow[]>(
        "campus_erp.api.administration.get_pending_approvals"
      ),
  })
  const pendingApprovals = (pendingApprovalsQuery.data ?? []).slice(0, 5)

  const recentStudentsQuery = useQuery({
    queryKey: ["Student", "recent"],
    queryFn: () =>
      frappe.list<RecentStudentRow>("Student", {
        fields: ["name", "student_name", "sms_status", "branch"],
        order_by: "creation desc",
        limit_page_length: 5,
      }),
  })
  const recentStudents = recentStudentsQuery.data ?? []

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{user ? `, ${user.full_name}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Students"
          value={studentCountQuery.data ?? "-"}
          icon={GraduationCap}
        />
        <StatCard label="Total Employees" value="1,234" icon={Users} />
        <StatCard label="Total Teachers" value="1,234" icon={Presentation} />
        <StatCard label="Total Earnings" value="₱1,234" icon={Banknote} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Enrollees</CardTitle>
            <CardDescription>By location, current term</CardDescription>
            <CardAction>
              <span className="font-heading text-2xl font-bold">
                {TOTAL_ENROLLEES.toLocaleString()}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ChartContainer config={ChartConfig} className="aspect-auto h-72 w-full">
              <BarChart accessibilityLayer data={ChartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="location"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 20)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="tourism" fill={ChartConfig.tourism.color} radius={4} />
                <Bar
                  dataKey="computer_science"
                  fill={ChartConfig.computer_science.color}
                  radius={4}
                />
                <Bar
                  dataKey="criminology"
                  fill={ChartConfig.criminology.color}
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Enrollees</CardTitle>
            <CardDescription>Newest student records</CardDescription>
            <CardAction>
              <Link
                href="/registrar/students"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all
                <ChevronRight className="size-4" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-1">
            {recentStudentsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                {recentStudents.map((student) => (
                  <div
                    key={student.name}
                    className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{student.student_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {student.branch ?? "—"}
                      </p>
                    </div>
                    <Badge variant="outline">{student.sms_status}</Badge>
                  </div>
                ))}
                {recentStudents.length === 0 && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No students yet.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Enrollees by Program</CardTitle>
            <CardDescription>Share of total enrollment</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {PROGRAM_TOTALS.map((program) => (
              <div key={program.key} className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{program.label}</span>
                  <span className="text-muted-foreground">
                    {program.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(program.value / TOTAL_ENROLLEES) * 100}%`,
                      backgroundColor: program.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Awaiting your recommendation or approval</CardDescription>
            <CardAction>
              <Link
                href="/administration/approvals"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all
                <ChevronRight className="size-4" />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {pendingApprovalsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((row) => (
                    <TableRow key={`${row.doctype}-${row.name}`}>
                      <TableCell className="text-muted-foreground">{row.doctype}</TableCell>
                      <TableCell>
                        <Link
                          href={`${APPROVAL_DETAIL_BASE_PATH[row.doctype] ?? "/administration/approvals"}/${encodeURIComponent(row.name)}`}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>{row.employee}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingApprovals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nothing pending on you right now.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
