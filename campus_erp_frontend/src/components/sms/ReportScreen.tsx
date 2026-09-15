"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import type { ReportSpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The 85 legacy filter-panel + CrystalReportViewer screens (blueprint §5.1):
 * a filter form feeding a result grid, with CSV export and print. Grouping
 * and subtotal logic that Crystal computed automatically must be reproduced
 * server-side in the backing report's get_data (blueprint §4.5) — this
 * component only renders whatever rows/columns the server returns.
 *
 * Totals footer (added for legacy screens with a bottom "Totals" panel,
 * e.g. Summary of Assessment's Assessment/Dues, Collection, Receivables):
 * backward compatible — if spec.totals is unset, or the method returns a
 * bare array (every pre-existing report), behavior is identical to before.
 * Only when spec.totals is set AND the response is a { rows, totals }
 * object does the footer render.
 */
type ReportRow = Record<string, unknown>
type ReportResponse = ReportRow[] | { rows: ReportRow[]; totals?: Record<string, unknown> }

export function ReportScreen({ spec }: { spec: ReportSpec }) {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [totals, setTotals] = useState<Record<string, unknown> | null>(null)
  const form = useForm<Record<string, unknown>>({ defaultValues: {} })

  const runMutation = useMutation({
    mutationFn: async (filters: Record<string, unknown>) => {
      if (!spec.method) {
        throw new Error(`ReportSpec for "${spec.title}" has no method configured yet`)
      }
      return frappe.call<ReportResponse>(spec.method, filters)
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        setRows(data)
        setTotals(null)
      } else {
        setRows(data?.rows ?? [])
        setTotals(data?.totals ?? null)
      }
    },
  })

  function exportCsv() {
    const header = spec.columns.map((c) => c.label).join(",")
    const body = rows
      .map((r) => spec.columns.map((c) => JSON.stringify(r[c.fieldname] ?? "")).join(","))
      .join("\n")
    const footer =
      spec.totals && totals
        ? spec.totals.map((t) => `${t.label},${JSON.stringify(totals[t.fieldname] ?? "")}`).join("\n")
        : ""
    const blob = new Blob([`${header}\n${body}${footer ? `\n\n${footer}` : ""}`], {
      type: "text/csv",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${spec.title}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">{spec.title}</h1>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => runMutation.mutate(values))}
          className="grid grid-cols-1 gap-4 rounded-md border p-4 sm:grid-cols-3"
        >
          {spec.filters.map((f) => (
            <DynamicField key={f.fieldname} control={form.control} spec={f} />
          ))}
          <div className="col-span-full flex gap-2">
            <Button type="submit" disabled={runMutation.isPending}>
              {runMutation.isPending ? "Running…" : "Run Report"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!rows.length}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!rows.length}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        </form>
      </Form>

      {runMutation.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {spec.columns.map((c) => (
                  <TableHead key={c.fieldname} style={{ width: c.width }}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {spec.columns.map((c) => (
                    <TableCell key={c.fieldname}>
                      {String(row[c.fieldname] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Set filters and run the report.
        </p>
      )}

      {spec.totals && totals && (
        <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-3">
          {spec.totals.map((t) => (
            <div key={t.fieldname} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {t.label}
              </span>
              <span className="text-lg font-semibold">
                {String(totals[t.fieldname] ?? "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
