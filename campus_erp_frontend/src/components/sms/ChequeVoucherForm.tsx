"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { GLEntryGrid } from "@/components/sms/GLEntryGrid"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"
import { financeRowInput, financePrimaryButton } from "@/lib/finance-ui"

interface ChequeVoucherValues {
  payee?: string
  date?: string
  check_number?: string
  check_date?: string
  amount?: string
  notes?: string
}

const GL_ENTRIES_SPEC = {
  fieldname: "gl_entries",
  doctype: "SMS Cheque Voucher GL Entry",
  variant: "gl-entries" as const,
  columns: [],
}

/**
 * Restyled to match VoucherEntryForm's (Journal Voucher's) plain layout —
 * title/description header, a Details section of grid fields, the GL entry
 * grid, a Totals section, and a bottom-right Save button — instead of the
 * earlier bespoke "disbursement voucher" check-card look. Kept as its own
 * component (rather than reusing VoucherEntryForm directly) since it needs
 * its own bespoke fields (payee, check number/date, amount) that
 * VoucherEntryForm's generic naming-series + remark shape doesn't cover.
 */
export function ChequeVoucherForm({ name, basePath }: { name?: string; basePath?: string }) {
  const doctype = "SMS Cheque Voucher Entry"
  const router = useRouter()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])

  const { data: doc, isLoading } = useQuery({
    queryKey: [doctype, name],
    queryFn: () => frappe.getDoc<Record<string, unknown>>(doctype, name!),
    enabled: !!name,
  })

  const { register, handleSubmit, reset } = useForm<ChequeVoucherValues>()

  useEffect(() => {
    if (!doc) return

    reset({
      payee: String(doc.payee ?? ""),
      date: String(doc.date ?? ""),
      check_number: String(doc.check_number ?? ""),
      check_date: String(doc.check_date ?? ""),
      amount: String(doc.amount ?? ""),
      notes: String(doc.notes ?? ""),
    })

    const nextRows = Array.isArray(doc.gl_entries)
      ? (doc.gl_entries as Array<Record<string, unknown>>)
      : []

    if (rows.length !== nextRows.length || rows.some((row, index) => row !== nextRows[index])) {
      queueMicrotask(() => setRows(nextRows))
    }
  }, [doc, reset, rows])

  const totals = useMemo<{ debit: number; credit: number }>(() => {
    return rows.reduce<{ debit: number; credit: number }>(
      (acc, r) => {
        acc.debit += Number(r.debit ?? 0)
        acc.credit += Number(r.credit ?? 0)
        return acc
      },
      { debit: 0, credit: 0 }
    )
  }, [rows])

  const isBalanced = rows.length === 0 || totals.debit === totals.credit

  const saveMutation = useMutation({
    mutationFn: async (values: ChequeVoucherValues) => {
      const payload = { ...values, gl_entries: rows }
      return name
        ? frappe.updateDoc(doctype, name, payload)
        : frappe.createDoc<Record<string, unknown>>(doctype, payload)
    },
    onSuccess: (saved) => {
      toast.success("Cheque voucher saved")
      queryClient.invalidateQueries({ queryKey: [doctype] })
      if (!name && basePath) {
        const newName = (saved as { name?: string })?.name
        if (newName) router.push(`${basePath}/${encodeURIComponent(newName)}`)
      }
    },
    onError: (error) => toast.error(`Could not save voucher: ${getErrorMessage(error)}`),
  })

  if (name && isLoading) {
    return <div className="h-96 w-full animate-pulse rounded-md bg-muted" />
  }

  return (
    <form
      className="grid max-w-3xl gap-3"
      onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {name ? `Cheque Voucher — ${name}` : "New Cheque Voucher"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record a check disbursement and its offsetting GL entries.
          </p>
        </div>
        {basePath && (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => router.push(basePath)}
          >
            Cancel
          </button>
        )}
      </div>

      <FinancePropertySection title="Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Payee
            <input
              {...register("payee")}
              placeholder="Payee name"
              className={`rounded border border-border ${financeRowInput}`}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Amount
            <input
              {...register("amount")}
              placeholder="0.00"
              className={`rounded border border-border ${financeRowInput}`}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Date
            <input
              type="date"
              {...register("date")}
              className={`rounded border border-border ${financeRowInput}`}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Check Number
            <input
              {...register("check_number")}
              placeholder="Check number"
              className={`rounded border border-border ${financeRowInput}`}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Check Date
            <input
              type="date"
              {...register("check_date")}
              className={`rounded border border-border ${financeRowInput}`}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Notes
            <textarea
              {...register("notes")}
              placeholder="Reason for this disbursement…"
              rows={2}
              className={`min-h-[72px] rounded border border-border ${financeRowInput}`}
            />
          </label>
        </div>
      </FinancePropertySection>

      <GLEntryGrid spec={GL_ENTRIES_SPEC} rows={rows} onChange={setRows} />

      <FinancePropertySection title="Totals">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Debit</p>
            <p className="mt-1 font-mono text-base text-foreground">₱{totals.debit.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Credit</p>
            <p className="mt-1 font-mono text-base text-foreground">₱{totals.credit.toFixed(2)}</p>
          </div>
        </div>
      </FinancePropertySection>

      <div className="flex items-center justify-end gap-3">
        {rows.length > 0 && !isBalanced && (
          <span className="text-xs text-destructive">Debits and credits must match before saving.</span>
        )}
        <button
          type="submit"
          className={financePrimaryButton}
          disabled={!isBalanced || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Post Voucher"}
        </button>
      </div>
    </form>
  )
}