"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
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

interface LoanTypeRow {
  name: string
  loan_code: string
  loan_name: string
  interest_rate?: number
  is_government_loan?: number
}

const emptyForm = { loan_code: "", loan_name: "", interest_rate: "", is_government_loan: false }

/**
 * Bespoke — SMS Loan Type is a plain flat master list (no child table, no
 * submittable state). Same conventions as PoliciesList.tsx /
 * codes-and-fees.tsx.
 */
export function LoanTypesList() {
  const queryClient = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ["SMS Loan Type", "list"],
    queryFn: () =>
      frappe.list<LoanTypeRow>("SMS Loan Type", {
        fields: ["name", "loan_code", "loan_name", "interest_rate", "is_government_loan"],
        order_by: "loan_name asc",
        limit_page_length: 500,
      }),
  })

  const [editingName, setEditingName] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isAdding, setIsAdding] = useState(false)

  function startAdd() {
    setIsAdding(true)
    setEditingName(null)
    setForm(emptyForm)
  }

  function startEdit(row: LoanTypeRow) {
    setIsAdding(false)
    setEditingName(row.name)
    setForm({
      loan_code: row.loan_code,
      loan_name: row.loan_name,
      interest_rate: row.interest_rate != null ? String(row.interest_rate) : "",
      is_government_loan: !!row.is_government_loan,
    })
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingName(null)
    setForm(emptyForm)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        loan_code: form.loan_code,
        loan_name: form.loan_name,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : undefined,
        is_government_loan: form.is_government_loan ? 1 : 0,
      }
      return editingName
        ? frappe.updateDoc<LoanTypeRow>("SMS Loan Type", editingName, payload)
        : frappe.createDoc<LoanTypeRow>("SMS Loan Type", payload)
    },
    onSuccess: async () => {
      toast.success("Loan Type saved")
      cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Loan Type"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc("SMS Loan Type", name),
    onSuccess: async (_, name) => {
      toast.success("Loan Type deleted")
      if (editingName === name) cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Loan Type"] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  const isFormOpen = isAdding || !!editingName
  const canSave = isFormOpen && !!form.loan_code && !!form.loan_name && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Loan Types</h2>
        <Button type="button" disabled={isAdding} onClick={startAdd}>
          <PlusIcon /> Add
        </Button>
      </div>

      {isFormOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
          <div className="grid gap-1.5">
            <label htmlFor="loan-code">Loan Code</label>
            <Input
              id="loan-code"
              autoFocus
              className="w-40"
              value={form.loan_code}
              onChange={(e) => setForm((p) => ({ ...p, loan_code: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="loan-name">Loan Name</label>
            <Input
              id="loan-name"
              className="w-56"
              value={form.loan_name}
              onChange={(e) => setForm((p) => ({ ...p, loan_name: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="interest-rate">Interest Rate</label>
            <Input
              id="interest-rate"
              type="number"
              className="w-32"
              value={form.interest_rate}
              onChange={(e) => setForm((p) => ({ ...p, interest_rate: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              id="is-government-loan"
              type="checkbox"
              checked={form.is_government_loan}
              onChange={(e) => setForm((p) => ({ ...p, is_government_loan: e.target.checked }))}
            />
            <label htmlFor="is-government-loan">Is Government Loan</label>
          </div>
          <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : editingName ? "Update" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={cancelForm}>
            Cancel
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan Code</TableHead>
              <TableHead>Loan Name</TableHead>
              <TableHead>Interest Rate</TableHead>
              <TableHead>Government Loan</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground text-center">
                  No loan types yet. Click Add to create one.
                </TableCell>
              </TableRow>
            ) : (
              (rows ?? []).map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  data-state={editingName === row.name ? "selected" : undefined}
                  onClick={() => startEdit(row)}
                >
                  <TableCell className="font-medium">{row.loan_code}</TableCell>
                  <TableCell>{row.loan_name}</TableCell>
                  <TableCell>{row.interest_rate ?? "—"}</TableCell>
                  <TableCell>{row.is_government_loan ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${row.loan_name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMutation.mutate(row.name)
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
