"use client"

import { use, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { assessmentSpec } from "@/lib/forms/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface AssessmentDoc {
  name: string
  docstatus: number
  receivable?: number
  payment?: number
  total_fee?: number
}

export default function AssessmentEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={assessmentSpec} name={docName} basePath="/finance/assessments" />
      {docName && <AssessmentActions name={docName} />}
    </div>
  )
}

/**
 * Bespoke panels alongside the generic EntryScreen: Submit (a docstatus 0->1
 * transition, which Frappe's REST layer runs on_submit hooks for) and Record
 * Payment (a whitelisted business-rule call, not plain field editing). Both
 * need the doc's own docstatus/receivable, fetched with the same
 * [doctype, name] query key EntryScreen uses internally — react-query treats
 * this as one shared query, so it's a free ride rather than a duplicate
 * request.
 */
function AssessmentActions({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")

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
          <h2 className="font-semibold">Record Payment</h2>
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
    </>
  )
}
