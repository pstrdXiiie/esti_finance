"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { travelOrderSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface TravelOrderDoc {
  name: string
  docstatus: number
  status?: string
}

export default function TravelOrderEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={travelOrderSpec} name={docName} basePath="/personnel/travel-orders" />
      {docName && <TravelOrderWorkflowPanel name={docName} />}
    </div>
  )
}

/**
 * The "SMS Travel Order Approval" Workflow drives status from here on — the
 * only correct way to move it is get_transitions/apply_workflow, never a
 * raw field update, so this queries the transitions valid for the current
 * user and fires apply_workflow for whichever one they pick.
 */
function TravelOrderWorkflowPanel({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc } = useQuery({
    queryKey: [travelOrderSpec.doctype, name],
    queryFn: () => frappe.getDoc<TravelOrderDoc>(travelOrderSpec.doctype, name),
  })

  const transitionsQuery = useQuery({
    queryKey: [travelOrderSpec.doctype, name, "transitions"],
    queryFn: () => frappe.getWorkflowTransitions(travelOrderSpec.doctype, name),
  })

  const workflowMutation = useMutation({
    mutationFn: (action: string) =>
      frappe.applyWorkflowAction(travelOrderSpec.doctype, name, action),
    onSuccess: (_, action) => {
      toast.success(`${action} applied`)
      queryClient.invalidateQueries({ queryKey: [travelOrderSpec.doctype, name] })
      queryClient.invalidateQueries({ queryKey: [travelOrderSpec.doctype, name, "transitions"] })
    },
    onError: (error) => toast.error(`Could not apply workflow action: ${getErrorMessage(error)}`),
  })

  if (!transitionsQuery.data || transitionsQuery.data.length === 0) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="grid gap-2 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Workflow Actions</h2>
          {doc?.status && <Badge variant="outline">{doc.status}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {transitionsQuery.data.map((t) => (
            <Button
              key={t.action}
              type="button"
              variant="secondary"
              disabled={workflowMutation.isPending}
              onClick={() => workflowMutation.mutate(t.action)}
            >
              {t.action}
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}
