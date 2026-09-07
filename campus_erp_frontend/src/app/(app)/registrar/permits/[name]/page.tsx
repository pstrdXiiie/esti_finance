"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
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
    <div className="grid gap-6">
      <EntryScreen spec={permitSpec} name={docName} basePath="/registrar/permits" />
      {docName && <PermitSubmitPanel name={docName} />}
    </div>
  )
}

/**
 * SMS Permit is submittable but has no Workflow attached (unlike SMS Loan
 * Application/Overtime/Travel Order), so a plain docstatus PUT is the
 * correct, safe way to submit it — same pattern as finance/assessments/[name]
 * and personnel/benefits/[name].
 */
function PermitSubmitPanel({ name }: { name: string }) {
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

  if (isLoading || !doc || doc.docstatus !== 0) {
    return null
  }

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
