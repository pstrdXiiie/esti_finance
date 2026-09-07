"use client"

import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface OverrideLogRow {
  name: string
  timestamp?: string
  user?: string
  overridden_by?: string
  reason?: string
  reference_doctype?: string
  reference_name?: string
}

/**
 * Read-only audit trail (blueprint Phase 5): every business-rule override
 * writes an SMS Override Log entry server-side, so there is no create/edit
 * UI here by design — just the list, newest first.
 */
export default function OverrideLogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["SMS Override Log", "list"],
    queryFn: () =>
      frappe.list<OverrideLogRow>("SMS Override Log", {
        fields: [
          "name",
          "timestamp",
          "user",
          "overridden_by",
          "reason",
          "reference_doctype",
          "reference_name",
        ],
        order_by: "timestamp desc",
        limit_page_length: 100,
      }),
  })

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Override Log</h1>
        <p className="text-muted-foreground">
          Audit trail of business-rule overrides across every module, newest first.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Overridden By</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reference Doctype</TableHead>
                <TableHead>Reference Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.timestamp}</TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell>{row.overridden_by}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>{row.reference_doctype}</TableCell>
                  <TableCell>{row.reference_name}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No overrides recorded yet.
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
