"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FinanceEntryScreen } from "@/components/finance/FinanceEntryScreen"

/**
 * Finance-styled counterpart to EntryListScreen: same spec-driven table,
 * but "New"/row-click opens the form in a Dialog instead of navigating to a
 * separate route or expanding inline. Registrar's curriculum/permits keep
 * using EntryListScreen + real routes; this is finance-only.
 *
 * If spec has a "root_type" field, a Root Type filter dropdown is rendered
 * above the table (driven by that field's options string), and a Print
 * button becomes available that renders ALL records (ignoring the active
 * filter) grouped into sections by root_type, then calls window.print().
 * Follows the same window.print()-on-visible-DOM convention as
 * ReportScreen.tsx; no dedicated print stylesheet exists elsewhere in the
 * app, so print-only content is toggled via Tailwind's print:/hidden
 * utilities instead.
 */
export function FinanceEntryListScreen({
  spec,
  renderExtra,
}: {
  spec: EntrySpec
  /** Extra content rendered below the form, only when editing an existing record. */
  renderExtra?: (name: string) => ReactNode
}) {
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null)
  const [activeName, setActiveName] = useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [rootTypeFilter, setRootTypeFilter] = useState<string>("all")

  const listColumns = spec.fields.filter((f) => f.inListView)
  const columns = listColumns.length ? listColumns : spec.fields.slice(0, 4)

  const rootTypeField = spec.fields.find((f) => f.fieldname === "root_type")
  const rootTypeOptions = rootTypeField?.options
    ? rootTypeField.options.split("\n").filter(Boolean)
    : []

  const filters: [string, string, unknown][] | undefined =
    rootTypeFilter !== "all" ? [["root_type", "=", rootTypeFilter]] : undefined

  const { data, isLoading } = useQuery({
    queryKey: [spec.doctype, "list", rootTypeFilter],
    queryFn: () =>
      frappe.list(spec.doctype, {
        fields: ["name", ...spec.fields.map((f) => f.fieldname)],
        filters,
        limit_page_length: 100,
      }),
  })

  // Always unfiltered, regardless of the on-screen Root Type filter above —
  // "Print" means the full chart, grouped by type, not just what's currently
  // narrowed down on screen.
  const { data: printData } = useQuery({
    queryKey: [spec.doctype, "list", "print-all"],
    queryFn: () =>
      frappe.list(spec.doctype, {
        fields: ["name", ...spec.fields.map((f) => f.fieldname)],
        limit_page_length: 500,
      }),
    enabled: rootTypeOptions.length > 0,
  })

  const printGroups =
    rootTypeOptions.length > 0 && printData
      ? [...rootTypeOptions, "Other"]
          .map((groupType) => ({
            type: groupType,
            rows: (printData as Array<Record<string, unknown>>)
              .filter((row) =>
                groupType === "Other"
                  ? !rootTypeOptions.includes(String(row.root_type ?? ""))
                  : row.root_type === groupType
              )
              .sort((a, b) =>
                String(a.account_number ?? a.account_name ?? "").localeCompare(
                  String(b.account_number ?? b.account_name ?? "")
                )
              ),
          }))
          .filter((g) => g.rows.length > 0)
      : []

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => frappe.deleteDoc(spec.doctype, name),
    onSuccess: () => {
      toast.success(`${spec.title} deleted`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype, "list"] })
      setDeleteTarget(null)
      if (deleteTarget?.name === activeName) closeForm()
    },
    onError: (error) => {
      toast.error(`Could not delete ${spec.title}: ${getErrorMessage(error)}`)
      setDeleteTarget(null)
    },
  })

  function openNew() {
    setActiveName(undefined)
    setFormOpen(true)
  }

  function openRow(name: string) {
    setActiveName(name)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setActiveName(undefined)
    queryClient.invalidateQueries({ queryKey: [spec.doctype, "list"] })
  }

  return (
    <div className="grid gap-4">
      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{spec.title}</h1>
        <div className="flex items-center gap-2">
          {rootTypeOptions.length > 0 && (
            <>
              <Select
                value={rootTypeFilter}
                onValueChange={(value) => setRootTypeFilter(value ?? "all")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {rootTypeOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!printGroups.length}
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </>
          )}
          <Button onClick={openNew}>Add {spec.title}</Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="print-hide h-64 w-full" />
      ) : (
        <div className="print-hide overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="justify-between bg-slate-900 hover:bg-slate-900 hover:text-white">
                {columns.map((c) => (
                  <TableHead className="hover:text-white text-white" key={c.fieldname}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-right hover:text-white text-white">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => (
                <TableRow key={String(row.name)}>
                  {columns.map((c, i) => (
                    <TableCell key={c.fieldname}>
                      {i === 0 ? (
                        <button
                          type="button"
                          onClick={() => openRow(String(row.name))}
                          className="font-medium hover:underline"
                        >
                          {String(row[c.fieldname] ?? row.name)}
                        </button>
                      ) : (
                        String(row[c.fieldname] ?? "")
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${spec.title}`}
                        onClick={() => openRow(String(row.name))}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${spec.title}`}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-muted-foreground text-center">
                    No records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Print-only view: hidden on screen, shown only when printing. */}
      {printGroups.length > 0 && (
        <div className="print-only">
          <h1 className="mb-4 text-xl font-semibold">{spec.title}</h1>
          {printGroups.map((group) => (
            <div key={group.type} className="mb-6 break-inside-avoid">
              <h2 className="mb-1 border-b border-black pb-1 text-sm font-bold uppercase">
                {group.type}
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black text-left">
                    {columns.map((c) => (
                      <th key={c.fieldname} className="py-1 pr-4 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={String(row.name)} className="border-b border-zinc-300">
                      {columns.map((c) => (
                        <td key={c.fieldname} className="py-1 pr-4">
                          {String(row[c.fieldname] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] w-fit max-w-[calc(100%-2rem)] overflow-y-auto border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">
            {activeName ? `Edit ${spec.title} — ${activeName}` : `New ${spec.title}`}
          </DialogTitle>
          <FinanceEntryScreen
            spec={spec}
            name={activeName}
            onSaved={(savedName) => {
              setActiveName(savedName)
              closeForm()
            }}
          />
          {activeName && renderExtra?.(activeName)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {spec.title}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove this {spec.title.toLowerCase()} record. This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget?.name && deleteMutation.mutate(String(deleteTarget.name))}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
