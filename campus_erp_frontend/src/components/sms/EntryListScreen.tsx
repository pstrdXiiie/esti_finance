"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
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

/**
 * List view for EntryScreen-backed doctypes (SMS Curriculum, SMS Permit, …):
 * rows link to a full detail page instead of opening a modal, since entry
 * documents carry a child-table grid that needs more room than a dialog.
 */
export function EntryListScreen({
  spec,
  basePath,
}: {
  spec: EntrySpec
  /** Route this list lives under, e.g. "/registrar/curriculum". */
  basePath: string
}) {
  const listColumns = spec.fields.filter((f) => f.inListView)
  const columns = listColumns.length ? listColumns : spec.fields.slice(0, 4)

  const { data, isLoading } = useQuery({
    queryKey: [spec.doctype, "list"],
    queryFn: () =>
      frappe.list(spec.doctype, {
        fields: ["name", ...spec.fields.map((f) => f.fieldname)],
        limit_page_length: 100,
      }),
  })

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{spec.title}</h1>
        <Button render={<Link href={`${basePath}/new`} />}>Add {spec.title}</Button>
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
              {(data ?? []).map((row) => (
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
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
                    No records yet.
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
