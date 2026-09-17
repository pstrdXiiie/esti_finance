"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { EntryScreen } from "@/components/sms/EntryScreen"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
import { itemLabel, useCascadeDelete } from "@/lib/cascadeDelete"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { MoreVerticalIcon, Plus, Search, Trash2Icon } from "lucide-react";

/**
 * List view for EntryScreen-backed doctypes (SMS Curriculum, SMS Permit, …):
 * rows link to a full detail page instead of opening a modal, since entry
 * documents carry a child-table grid that needs more room than a dialog.
 *
 * cardStyle is a purely visual opt-in (default false, so every existing
 * consumer is unchanged): swaps the outer wrapper and header row for the
 * rounded-2xl card shell + bottom-border toolbar used by the bespoke
 * Curriculum Offered screen, and adds a leading icon to the Add button.
 * No behavior changes — same data flow, same routing/inlineAdd logic.
 */
export function EntryListScreen({
  spec,
  basePath,
  inlineAdd = false,
  filters,
  cardStyle = false,
  allowDelete = false,
}: {
  spec: EntrySpec
  basePath: string
  /** When true, "Add" opens an inline panel above the table instead ofnavigating to a new route. */
  inlineAdd?: boolean
  /** Server-side filters applied to the list query, e.g. excluding cancelled records. */
  filters?: Array<[string, string, unknown]>
  /** Purely visual opt-in: rounded-2xl card shell + bordered toolbar matching Curriculum Offered. Default false leaves existing consumers unchanged. */
  cardStyle?: boolean
  /**
   * Opt-in per-row "…" menu with Delete, reusing the same cascade-aware
   * delete flow as MasterDetailScreen (see useCascadeDelete) -- resolves
   * whatever links block the delete (cancelling first where the spec's own
   * cancelAndDeleteDoctypes says that's sanctioned) instead of just failing.
   * Default false leaves every existing consumer unchanged; Edit is already
   * the row's own link, so this only adds Delete, not a redundant Edit item.
   */
  allowDelete?: boolean
}) {
  const queryClient = useQueryClient()
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [search, setSearch] = useState("")
  const listColumns = spec.fields.filter((f) => f.inListView)
  const columns = listColumns.length ? listColumns : spec.fields.slice(0, 4)
  const { deleteMutation } = useCascadeDelete(spec)

  const { data, isLoading, error } = useQuery({
    queryKey: [spec.doctype, "list", filters],
    queryFn: () =>
      // Only the columns actually rendered below -- not every spec.fields
      // entry. A wizard-only field that isn't a real column on the doctype
      // (e.g. assessmentSpec's payment_mode/installment_months, which exist
      // purely to drive the Fees & Tuition step's preview math and are
      // deliberately never persisted -- see save_assessment's docstring in
      // campus_erp.api.finance_billing) would otherwise break this query's
      // SELECT with an unknown-column error, which silently rendered as an
      // empty "No records yet." table instead of the real failure.
      frappe.list(spec.doctype, {
        fields: ["name", ...columns.map((c) => c.fieldname)],
        filters,
        limit_page_length: 100,
      }),
  })

  const filteredData = (data ?? []).filter((row) =>
    !search.trim() ||
      columns.some((c) =>
        String(row[c.fieldname] ?? "").toLowerCase().includes(search.toLowerCase())
      )
  )

  return (
    <div
      className={
        cardStyle
          ? "rounded-2xl border border-border h-full p-6 flex flex-col gap-5 overflow-y-auto"
          : "grid gap-4"
      }
    >
      <div
        className={
          cardStyle
            ? "flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4"
            : "flex items-center justify-between"
        }
      >
        <h1 className="text-2xl font-semibold">{spec.title}</h1>
        {inlineAdd ? (
          <Button onClick={() => setShowAddPanel((v) => !v)}>
            {cardStyle && !showAddPanel && <Plus className="h-4 w-4" />}
            {showAddPanel ? "Cancel" : `Add ${spec.title}`}
          </Button>
        ) : (
          <Button render={<Link href={`${basePath}/new`} />} nativeButton={false}>
            {cardStyle && <Plus className="h-4 w-4" />}
            Add {spec.title}
          </Button>
        )}
      </div>

      {inlineAdd && showAddPanel && (
        <div className="w-full min-w-0 rounded-md border p-4">
          <EntryScreen
            spec={spec}
            onSaved={() => {
              setShowAddPanel(false)
              queryClient.invalidateQueries({ queryKey: [spec.doctype] })
            }}
          />
        </div>
      )}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={`Search ${spec.title.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive">
          Could not load {spec.title.toLowerCase()}: {getErrorMessage(error)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.fieldname}>{c.label}</TableHead>
                ))}
                {allowDelete && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row) => (
                <TableRow key={String(row.name)}>
                  {columns.map((c, i) => (
                    <TableCell key={c.fieldname}>
                      {i === 0 ? (
                        <Link
                          href={`${basePath}/${encodeURIComponent(String(row.name))}`}
                          className="font-medium hover:underline"
                        >
                          {String(row[c.fieldname] ?? row.name)}
                        </Link>
                      ) : c.fieldtype === "Check" ? (
                        row[c.fieldname] ? "Yes" : ""
                      ) : (
                        String(row[c.fieldname] ?? "")
                      )}
                    </TableCell>
                  ))}
                  {allowDelete && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`More actions for ${itemLabel(spec.title, 1)}`}
                            />
                          }
                        >
                          <MoreVerticalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete this ${itemLabel(spec.title, 1)}? This cannot be undone.`
                                )
                              ) {
                                deleteMutation.mutate(String(row.name))
                              }
                            }}
                          >
                            <Trash2Icon />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + (allowDelete ? 1 : 0)} className="text-muted-foreground text-center">
                    {search.trim() ? "No matching records." : "No records yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
