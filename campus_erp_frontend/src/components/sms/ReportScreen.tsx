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
 */
export function ReportScreen({ spec }: { spec: ReportSpec }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const form = useForm<Record<string, unknown>>({ defaultValues: {} })

  const runMutation = useMutation({
    mutationFn: async (filters: Record<string, unknown>) => {
      if (!spec.method) {
        throw new Error(`ReportSpec for "${spec.title}" has no method configured yet`)
      }
      return frappe.call<Array<Record<string, unknown>>>(spec.method, filters)
    },
    onSuccess: (data) => setRows(data ?? []),
  })

  function exportCsv() {
    const header = spec.columns.map((c) => c.label).join(",")
    const body = rows
      .map((r) => spec.columns.map((c) => JSON.stringify(r[c.fieldname] ?? "")).join(","))
      .join("\n")
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" })
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
    </div>
  )
}
