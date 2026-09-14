"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { EyeIcon, FilterIcon, MoreVerticalIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
// Same restriction MasterDetailScreen applies to its free-text search box —
// only text-ish/lookup columns are searched, not Int/Date/Check/etc.
const searchableColumns = listColumns.filter((c) =>
  ["Data", "Text", "Small Text", "Link", "Select"].includes(c.fieldtype)
)

interface EmployeesListProps {
  /** Route prefix for add/detail navigation, e.g. "/personnel/employees". */
  basePath: string
}

/**
 * Pure list + navigation. Add routes to `${basePath}/new`, each row routes
 * to `${basePath}/${name}` (see 05-PERSONNEL-IMPLEMENTATION-PLAN.md).
 *
 * Search + Filter bar mirrors MasterDetailScreen.tsx's (see
 * registrar/students) exactly: a magnifying-glass search box filtering
 * across the searchable list columns, plus a "Filter" toggle that reveals a
 * column picker + "value contains" box for narrowing to one specific
 * column. Employees can't use MasterDetailScreen itself — Add opens a
 * multi-step wizard and each row opens a tabbed detail page, not
 * MasterDetailScreen's single-dialog add/edit — so this reproduces just its
 * search/filter behavior client-side over the fetched rows.
 *
 * Row actions: a single kebab (⋮) menu per row, matching the app's
 * standard row-menu pattern elsewhere — but scoped down to just View and
 * Delete for Employees specifically. Edit and Drop (both present in the
 * app's usual menu) are intentionally omitted here: "edit" already IS
 * "view" for this screen (the detail page at `${basePath}/${name}` is
 * fully editable via EmployeeDetailTabs, so a separate Edit entry would
 * just duplicate View), and Drop (soft-disable via a status field) doesn't
 * apply — Personnel Info has no such status/drop field the way e.g.
 * enrollment records do.
 */
export function EmployeesList({ basePath }: EmployeesListProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState("")
  const [filterValue, setFilterValue] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: [employeeSpec.doctype, "list"],
    queryFn: () =>
      frappe.list<EmployeeRow>(employeeSpec.doctype, {
        fields: ["name", ...employeeSpec.fields.map((f) => f.fieldname)],
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

  function applyFilter(field: string, value: string) {
    setFilterField(field)
    setFilterValue(value)
  }

  const filteredRows = useMemo(() => {
    let rows = data ?? []

    if (search.trim()) {
      const needle = search.trim().toLowerCase()
      const haystack = searchableColumns.length ? searchableColumns : listColumns
      rows = rows.filter((row) =>
        haystack.some((c) => String(row[c.fieldname] ?? "").toLowerCase().includes(needle))
      )
    }

    if (filterField && filterValue.trim()) {
      const needle = filterValue.trim().toLowerCase()
      rows = rows.filter((row) => String(row[filterField] ?? "").toLowerCase().includes(needle))
    }

    return rows
  }, [data, search, filterField, filterValue])

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setFilterOpen((v) => !v)}>
            <FilterIcon />
            Filter
          </Button>
          {filterField && filterValue.trim() && (
            <Button type="button" variant="ghost" size="sm" onClick={() => applyFilter("", "")}>
              Clear filter
              <XIcon />
            </Button>
          )}
        </div>
        <Button type="button" onClick={() => router.push(`${basePath}/new`)}>
          <PlusIcon /> Add Employee
        </Button>
      </div>

      {filterOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <Select value={filterField} onValueChange={(value) => applyFilter(value ?? "", filterValue)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by column" />
            </SelectTrigger>
            <SelectContent>
              {listColumns.map((c) => (
                <SelectItem key={c.fieldname} value={c.fieldname}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={filterValue}
            onChange={(e) => applyFilter(filterField, e.target.value)}
            placeholder="Value contains..."
            disabled={!filterField}
            className="w-48"
          />
        </div>
      )}

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
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={listColumns.length + 1} className="text-muted-foreground text-center">
                  {data && data.length > 0 ? "No employees match these filters." : "No employees yet."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  onClick={() => router.push(`${basePath}/${encodeURIComponent(row.name)}`)}
                >
                  {listColumns.map((c) => (
                    <TableCell key={c.fieldname}>{row[c.fieldname] ?? ""}</TableCell>
                  ))}
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${row.first_name} ${row.last_name}`}
                          />
                        }
                      >
                        <MoreVerticalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`${basePath}/${encodeURIComponent(row.name)}`)}
                        >
                          <EyeIcon />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(row.name)}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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