"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { GLEntryGrid } from "@/components/sms/GLEntryGrid"
import { FinancePropertyPanel } from "@/components/finance/FinancePropertyPanel"
import { financeRowInput } from "@/lib/finance-ui"

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
    <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
      <FinancePropertyPanel
        title={`Check Voucher Transaction — ${name ?? "New"}`}
        onCancel={basePath ? () => router.push(basePath) : undefined}
        onSave={handleSubmit((values) => saveMutation.mutate(values))}
        saveLabel="Post Voucher"
        isSaving={saveMutation.isPending}
      >
        <div className="m-4 rounded-md border border-[#D9DCE3] bg-[#F7F5F0] text-[#1B2A4A]">
          <div className="flex items-start justify-between px-7 pb-4 pt-6">
            <div>
              <p className="font-serif text-[15px] font-semibold tracking-wide">Esti School Finance Office</p>
              <p className="mt-0.5 text-[10px] tracking-wider text-[#5B6B85]">DISBURSEMENT VOUCHER</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#5B6B85]">Date</span>
              <input
                type="date"
                {...register("date")}
                className="ml-1.5 border-b border-[#D9DCE3] bg-transparent px-0 py-0.5 text-right font-mono text-xs text-[#1B2A4A] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5 px-7 pb-1 pt-1.5">
            <span className="whitespace-nowrap text-xs text-[#5B6B85]">Payee</span>
            <input
              {...register("payee")}
              placeholder="Payee name"
              className="flex-1 border-b border-[#1B2A4A] bg-transparent px-0.5 py-1 font-serif text-[15px] italic text-[#1B2A4A] focus:outline-none"
            />
            <span className="text-xs text-[#5B6B85]">Amount ₱</span>
            <input
              {...register("amount")}
              placeholder="0.00"
              className="w-28 border-b border-[#1B2A4A] bg-transparent px-0.5py-1 text-right font-mono text-[15px] text-[#1B2A4A] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-5 px-7 pb-5 pt-3">
            <div>
              <p className="mb-1 text-[10px] tracking-wide text-[#5B6B85]">CHECK NUMBER</p>
              <input
                {...register("check_number")}
                placeholder="Check number"
                className="w-full border-b border-[#D9DCE3] bg-transparent px-0.5 py-1 font-mono text-sm text-[#1B2A4A] focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] tracking-wide text-[#5B6B85]">CHECK DATE</p>
              <input
                type="date"
                {...register("check_date")}
                className="w-full border-b border-[#D9DCE3] bg-transparent px-0.5 py-1 font-mono text-sm text-[#1B2A4A] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-5 px-7 pb-4.5">
            <div className="w-52 text-center">
              <div className="h-5.5 border-b border-[#1B2A4A]" />
              <p className="mt-0.5 text-[9px] tracking-wide text-[#5B6B85]">AUTHORIZED SIGNATURE</p>
            </div>
          </div>

          <div className="flex justify-between rounded-b-md bg-[#1B2A4A] px-7py-2">
            <span className="font-mono text-xs tracking-[0.18em] text-[#E7EAF2]">⑈{name ?? "NEW"}⑈</span>
            <span className="font-mono text-xs tracking-[0.18em] text-[#E7EAF2]">₱ auto</span>
          </div>
        </div>

        <GLEntryGrid spec={GL_ENTRIES_SPEC} rows={rows} onChange={setRows} />

        <div className="border-t border-zinc-200 px-5 py-4">
          <p className="mb-1 text-xs text-zinc-500">Notes</p>
          <textarea {...register("notes")} placeholder="Notes" rows={2} className={`rounded border border-zinc-200 ${financeRowInput}`} />
        </div>
      </FinancePropertyPanel>
    </form>
  )
}
