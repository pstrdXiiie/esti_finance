"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { BookOpen } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { assessmentSpec } from "@/lib/forms/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { StudentAssessmentLedgerDialog } from "@/components/finance/StudentAssessmentLedgerDialog"

interface AssessmentDoc {
  name: string
  docstatus: number
  receivable?: number
  payment?: number
  total_fee?: number
  student_name?: string
}

export function AssessmentActions({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const [ledgerOpen, setLedgerOpen] = useState(false)

  const { data: doc, isLoading } = useQuery({
    queryKey: [assessmentSpec.doctype, name],
    queryFn: () => frappe.getDoc<AssessmentDoc>(assessmentSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(assessmentSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Assessment submitted")
      queryClient.invalidateQueries({ queryKey: [assessmentSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit assessment: ${getErrorMessage(error)}`),
  })

  const paymentMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ receivable?: number }>("campus_erp.api.finance_billing.record_payment", {
        assessment: name,
        amount: Number(amount),
      }),
    onSuccess: (result) => {
      toast.success(
        result?.receivable != null
          ? `Payment recorded. Receivable balance: ${result.receivable}`
          : "Payment recorded"
      )
      setAmount("")
      queryClient.invalidateQueries({ queryKey: [assessmentSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not record payment: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!doc) {
    return null
  }

  return (
    <>
      <Separator />

      {doc.docstatus === 0 && (
        <div className="grid gap-2 rounded-md border p-4">
          <h2 className="font-semibold">Submit Assessment</h2>
          <p className="text-sm text-muted-foreground">
            Submitting locks the assessment and posts its GL entries; payments can only
            be recorded afterward.
          </p>
          <Button
            type="button"
            className="w-fit"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Assessment"}
          </Button>
        </div>
      )}

      {doc.docstatus === 1 && (
        <div className="grid gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Record Payment</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setLedgerOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Ledger
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Current receivable balance: {doc.receivable ?? 0}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="w-40"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!amount || Number(amount) <= 0 || paymentMutation.isPending}
              onClick={() => paymentMutation.mutate()}
            >
              {paymentMutation.isPending ? "Recording…" : "Record Payment"}
            </Button>
          </div>
        </div>
      )}

      <StudentAssessmentLedgerDialog
        assessmentName={name}
        studentName={doc.student_name}
        totalFee={Number(doc.total_fee ?? 0)}
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
      />
    </>
  )
}
