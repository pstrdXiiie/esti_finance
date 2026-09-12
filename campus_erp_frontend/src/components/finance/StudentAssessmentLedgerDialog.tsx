"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Printer } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PaymentEntryRefRow {
  parent: string
  allocated_amount: number
}

interface PaymentEntryRow {
  name: string
  posting_date: string
  mode_of_payment?: string
  reference_no?: string
  paid_amount: number
}

interface LedgerRow {
  date: string
  transaction: string
  or_number: string
  debit: number
  credit: number
  balance: number
}

export function StudentAssessmentLedgerDialog({
  assessmentName,
  studentName,
  totalFee,
  open,
  onOpenChange,
}: {
  assessmentName: string
  studentName?: string
  totalFee: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: refs = [], isLoading: refsLoading } = useQuery({
    queryKey: ["Payment Entry Reference", "list", assessmentName],
    queryFn: () =>
      frappe.list<PaymentEntryRefRow>("Payment Entry Reference", {
        fields: ["parent", "allocated_amount"],
        filters: [
          ["reference_doctype", "=", "SMS Student Assessment"],
          ["reference_name", "=", assessmentName],
        ],
        limit_page_length: 100,
      }),
    enabled: open,
  })

  const parentNames = useMemo(() => refs.map((r) => r.parent), [refs])

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["Payment Entry", "list", parentNames],
    queryFn: () =>
      frappe.list<PaymentEntryRow>("Payment Entry", {
        fields: ["name", "posting_date", "mode_of_payment", "reference_no", "paid_amount"],
        filters: [["name", "in", parentNames]],
        order_by: "posting_date asc",
        limit_page_length: 100,
      }),
    enabled: open && parentNames.length > 0,
  })

  const isLoading = refsLoading || (parentNames.length > 0 && entriesLoading)

  const rows: LedgerRow[] = useMemo(() => {
    const out: LedgerRow[] = []
    let balance = totalFee
    out.push({
      date: "—",
      transaction: "Assessment Posted",
      or_number: "",
      debit: totalFee,
      credit: 0,
      balance,
    })
    for (const e of entries) {
      balance -= Number(e.paid_amount ?? 0)
      out.push({
        date: e.posting_date,
        transaction: e.mode_of_payment ? `Payment (${e.mode_of_payment})` : "Payment",
        or_number: e.reference_no ?? "",
        debit: 0,
        credit: Number(e.paid_amount ?? 0),
        balance,
      })
    }
    return out
  }, [entries, totalFee])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ledger</DialogTitle>
        </DialogHeader>

        <div className="grid gap-1 rounded-lg border p-4 text-sm">
          <div className="grid grid-cols-[100px_1fr] gap-1">
            <span className="text-muted-foreground">Assessment</span>
            <span className="font-semibold">{assessmentName}</span>
          </div>
          {studentName && (
            <div className="grid grid-cols-[100px_1fr] gap-1">
              <span className="text-muted-foreground">Student</span>
              <span className="font-semibold">{studentName}</span>
            </div>
          )}
        </div>

        <div className="max-h-80 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Transaction</th>
                <th className="px-3 py-2 text-left">OR #</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading &&
                rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.transaction}</td>
                    <td className="px-3 py-2">{r.or_number}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.debit ? Number(r.debit).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.credit ? Number(r.credit).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {Number(r.balance ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
