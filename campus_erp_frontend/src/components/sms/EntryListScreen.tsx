"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { EntryScreen } from "@/components/sms/EntryScreen"

import { frappe } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
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
import { Plus, Search } from "lucide-react";

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
<<<<<<< HEAD
  inlineAdd = false,
  filters,
  cardStyle = false,
=======
  filters,
>>>>>>> 4dd3f8d (Reconstruct Permit to Take Exam section and  fix holidays section mispelled characters in its doctype)
}: {
  spec: EntrySpec
  basePath: string
<<<<<<< HEAD
  /** When true, "Add" opens an inline panel above the table instead ofnavigating to a new route. */
  inlineAdd?: boolean
  /** Server-side filters applied to the list query, e.g. excluding cancelled records. */
  filters?: Array<[string, string, unknown]>
  /** Purely visual opt-in: rounded-2xl card shell + bordered toolbar matching Curriculum Offered. Default false leaves existing consumers unchanged. */
  cardStyle?: boolean
=======
  /** Optional server-side filters (e.g. excluding cancelled records) — forwarded as-is to frappe.list. */
  filters?: Array<[string, string, unknown]>
>>>>>>> 4dd3f8d (Reconstruct Permit to Take Exam section and  fix holidays section mispelled characters in its doctype)
}) {
  const queryClient = useQueryClient()
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [search, setSearch] = useState("")
  const listColumns = spec.fields.filter((f) => f.inListView)
  const columns = listColumns.length ? listColumns : spec.fields.slice(0, 4)

  const { data, isLoading } = useQuery({
    queryKey: [spec.doctype, "list", filters],
    queryFn: () =>
      frappe.list(spec.doctype, {
        fields: ["name", ...spec.fields.map((f) => f.fieldname)],
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
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.fieldname}>{c.label}</TableHead>
                ))}
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
                      ) : (
                        String(row[c.fieldname] ?? "")
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
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
