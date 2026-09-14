"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { PermitForm } from "@/components/ui/registrar/permits/permit-form"
import { permitSpec } from "@/lib/forms/registrar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface PermitDoc {
  name: string
  docstatus: number
}

export default function PermitEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    // Keyed on the doc name so navigating straight from one permit to
    // another (or to "new") in the same tab remounts this fresh — [name]
    // is one shared route, so without a key React reuses the previous
    // instance and its local state (e.g. added Subjects rows) leaks in.
    <div key={docName ?? "new"} className="grid gap-6">
      <PermitForm name={docName} basePath="/registrar/permits" />
      {docName && <PermitLifecyclePanel name={docName} />}
    </div>
  )
}

/**
 * SMS Permit is submittable but has no Workflow attached (unlike SMS Loan
 * Application/Overtime/Travel Order), so a plain docstatus PUT is the
 * correct, safe way to submit/cancel it — same pattern as
 * finance/assessments/[name] and personnel/benefits/[name]. Shows Submit
 * while still a draft (docstatus 0), Cancel once submitted (docstatus 1),
 * and nothing once cancelled (docstatus 2) — cancelling a submitted Frappe
 * doc is terminal, an amended copy would be a separate document.
 */
function PermitLifecyclePanel({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [permitSpec.doctype, name],
    queryFn: () => frappe.getDoc<PermitDoc>(permitSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(permitSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Permit submitted")
      queryClient.invalidateQueries({ queryKey: [permitSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit permit: ${getErrorMessage(error)}`),
  })

  const cancelMutation = useMutation({
    mutationFn: () => frappe.updateDoc(permitSpec.doctype, name, { docstatus: 2 }),
    onSuccess: () => {
      toast.success("Permit cancelled")
      queryClient.invalidateQueries({ queryKey: [permitSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not cancel permit: ${getErrorMessage(error)}`),
  })

  if (isLoading || !doc) {
    return null
  }

  if (doc.docstatus === 0) {
    return (
      <>
        <Separator />
        <div className="grid gap-2 rounded-md border p-4">
          <h2 className="font-semibold">Submit Permit</h2>
          <p className="text-sm text-muted-foreground">
            Submitting locks this permit against further edits.
          </p>
          <Button
            type="button"
            className="w-fit"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </>
    )
  }

  if (doc.docstatus === 1) {
    return (
      <>
        <Separator />
        <div className="grid gap-2 rounded-md border p-4">
          <h2 className="font-semibold">Cancel Permit</h2>
          <p className="text-sm text-muted-foreground">
            Cancelling voids this permit — it can no longer be used and cannot be edited afterward.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="w-fit"
            disabled={cancelMutation.isPending}
            onClick={() => {
              if (window.confirm("Cancel this permit? This cannot be undone.")) {
                cancelMutation.mutate()
              }
            }}
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel Permit"}
          </Button>
        </div>
      </>
    )
  }

  return null
}
