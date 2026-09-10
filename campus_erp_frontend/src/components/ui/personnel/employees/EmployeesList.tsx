"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
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

type EmployeeRow = Record<string, string> & { name: string }

const listColumns = employeeSpec.fields.filter((f) => f.inListView)

interface EmployeesListProps {
  /** Route prefix for add/detail navigation, e.g. "/personnel/employees". */
  basePath: string
}

/**
 * Pure list + navigation — no local wizard/panel state anymore. Add routes
 * to `${basePath}/new`, each row routes to `${basePath}/${name}`, matching
 * the same isNew-sentinel convention already used by loans/benefits/etc.
 * (see 05-PERSONNEL-IMPLEMENTATION-PLAN.md). "View" and "Edit" are no
 * longer separate actions — the detail page (EmployeeDetailTabs) is
 * editable inline, so there's a single Open action plus Delete.
 * Shared by both the Employees tab in personnel/page.tsx and the
 * standalone /personnel/employees route.
 */
export function EmployeesList({ basePath }: EmployeesListProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")

  const { data: rows, isLoading } = useQuery({
    queryKey: [employeeSpec.doctype, "list", search],
    queryFn: () =>
      frappe.list<EmployeeRow>(employeeSpec.doctype, {
        fields: ["name", ...employeeSpec.fields.map((f) => f.fieldname)],
        or_filters: search
          ? [
              ["employee_id", "like", `%${search}%`],
              ["first_name", "like", `%${search}%`],
              ["last_name", "like", `%${search}%`],
            ]
          : undefined,
        order_by: "modified desc",
        limit_page_length: 100,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc(employeeSpec.doctype, name),
    onSuccess: async () => {
      toast.success("Employee deleted")
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search employees…"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" onClick={() => router.push(`${basePath}/new`)}>
          <PlusIcon /> Add Employee
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {listColumns.map((c) => (
                <TableHead key={c.fieldname}>{c.label}</TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={listColumns.length + 1}>
                  <Skeleton className="h-24 w-full" />
                </TableCell>
              </TableRow>
            ) : (rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={listColumns.length + 1} className="text-muted-foreground text-center">
                  No employees yet.
                </TableCell>
              </TableRow>
            ) : (
              (rows ?? []).map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  onClick={() => router.push(`${basePath}/${encodeURIComponent(row.name)}`)}
                >
                  {listColumns.map((c) => (
                    <TableCell key={c.fieldname}>{row[c.fieldname] ?? ""}</TableCell>
                  ))}
                  <TableCell className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Open ${row.first_name} ${row.last_name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`${basePath}/${encodeURIComponent(row.name)}`)
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${row.first_name} ${row.last_name}`}
                      onClick={() => deleteMutation.mutate(row.name)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
