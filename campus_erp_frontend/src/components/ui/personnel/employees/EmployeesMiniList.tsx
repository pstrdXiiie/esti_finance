"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { employeeSpec } from "@/lib/forms/personnel"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface EmployeeMiniRow {
  name: string
  employee_id: string
  first_name: string
  last_name: string
  department: string | null
  employee_status: string | null
}

const MINI_COLUMNS = [
  { key: "employee_id", label: "Employee ID" },
  { key: "name", label: "Name" },
  { key: "department", label: "Department" },
  { key: "employee_status", label: "Status" },
] as const

interface EmployeesMiniListProps {
  /** Route prefix for row navigation, e.g. "/personnel/employees". */
  basePath: string
  /** Max rows shown at once. Defaults to 8. */
  limit?: number
}

/**
 * Compact companion to EmployeesList.tsx — a single search box plus a
 * capped number of top results, no filter panel, no pagination, no bulk
 * select/edit/delete. Meant for the Employees Details tab where quick
 * lookup matters more than full management; the full-featured list still
 * lives wherever `basePath` points (e.g. /personnel/employees).
 *
 * Uses its own query key (not employeeSpec.doctype's shared "list" key)
 * since it only fetches a narrow field set — sharing a key with
 * EmployeesList's broader `fields` would risk each view serving the
 * other's incomplete cached shape.
 */
export function EmployeesMiniList({ basePath, limit = 8 }: EmployeesMiniListProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: [employeeSpec.doctype, "list", "mini"],
    queryFn: () =>
      frappe.list<EmployeeMiniRow>(employeeSpec.doctype, {
        fields: ["name", "employee_id", "first_name", "last_name", "department", "employee_status"],
        order_by: "modified desc",
        limit_page_length: 200,
      }),
  })

  const matches = useMemo(() => {
    const rows = data ?? []
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.employee_id, row.first_name, row.last_name, row.department].some((value) =>
        String(value ?? "").toLowerCase().includes(needle)
      )
    )
  }, [data, search])

  const visibleRows = matches.slice(0, limit)

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-4">
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {MINI_COLUMNS.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={MINI_COLUMNS.length}>
                  <Skeleton className="h-24 w-full" />
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={MINI_COLUMNS.length} className="text-muted-foreground text-center">
                  {search.trim() ? "No employees match your search." : "No employees yet."}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  onClick={() => router.push(`${basePath}/${encodeURIComponent(row.name)}`)}
                >
                  <TableCell>{row.employee_id}</TableCell>
                  <TableCell>
                    {row.first_name} {row.last_name}
                  </TableCell>
                  <TableCell>{row.department ?? ""}</TableCell>
                  <TableCell>{row.employee_status ?? ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && matches.length > limit && (
        <p className="text-sm text-muted-foreground">
          Showing {limit} of {matches.length} matching employees.{" "}
          <Link href={basePath} className="font-medium underline underline-offset-2">
            View full list
          </Link>
        </p>
      )}
    </div>
  )
}
