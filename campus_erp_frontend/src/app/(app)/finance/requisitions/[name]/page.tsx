"use client"

import { use } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { requisitionSpec } from "@/lib/forms/purchasing"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface RequisitionDoc {
  name: string
  docstatus: number
}

export default function RequisitionEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={requisitionSpec} name={docName} basePath="/finance/requisitions" />
      {docName && <RequisitionActions name={docName} />}
    </div>
  )
}

/**
 * Bespoke panels alongside the generic EntryScreen: Submit (a docstatus 0->1
 * transition, same pattern as finance/assessments) and, once submitted,
 * "Create Purchase Order(s)" — the whitelisted
 * campus_erp.api.finance_purchasing.create_purchase_orders_from_requisition
 * groups this requisition's items by their per-line Supplier into one
 * Purchase Order per distinct supplier. Material Request has no clean
 * "Approved"-equivalent status of its own (native options are Draft /
 * Submitted / Stopped / Cancelled / Pending / Partially Ordered / Partially
 * Received / Ordered / Issued / Transferred / Received), so per the
 * migration plan this is shown for any submitted (docstatus 1) requisition
 * rather than gated on a specific status value.
 */
function RequisitionActions({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [requisitionSpec.doctype, name],
    queryFn: () => frappe.getDoc<RequisitionDoc>(requisitionSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(requisitionSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Requisition submitted")
      queryClient.invalidateQueries({ queryKey: [requisitionSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit requisition: ${getErrorMessage(error)}`),
  })

  const createPOMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ purchase_orders: string[] }>(
        "campus_erp.api.finance_purchasing.create_purchase_orders_from_requisition",
        { material_request: name }
      ),
    onSuccess: (result) => {
      const created = result?.purchase_orders ?? []
      toast.success(
        created.length
          ? `Created Purchase Order${created.length > 1 ? "s" : ""}: ${created.join(", ")}`
          : "No Purchase Orders were created"
      )
      queryClient.invalidateQueries({ queryKey: ["Purchase Order"] })
    },
    onError: (error) => toast.error(`Could not create Purchase Order(s): ${getErrorMessage(error)}`),
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
          <h2 className="font-semibold">Submit Requisition</h2>
          <p className="text-sm text-muted-foreground">
            Submitting locks the requisition so Purchase Orders can be created from it.
          </p>
          <Button
            type="button"
            className="w-fit"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Requisition"}
          </Button>
        </div>
      )}

      {doc.docstatus === 1 && (
        <div className="grid gap-3 rounded-md border p-4">
          <h2 className="font-semibold">Create Purchase Order(s)</h2>
          <p className="text-sm text-muted-foreground">
            Groups this requisition&apos;s items by Supplier into one Purchase Order per distinct
            supplier. Every line needs a Supplier set first.
          </p>
          <Button
            type="button"
            className="w-fit"
            disabled={createPOMutation.isPending}
            onClick={() => createPOMutation.mutate()}
          >
            {createPOMutation.isPending ? "Creating…" : "Create Purchase Order(s)"}
          </Button>
          {!!createPOMutation.data?.purchase_orders?.length && (
            <div className="flex flex-wrap gap-2">
              {createPOMutation.data.purchase_orders.map((po) => (
                <Button
                  key={po}
                  variant="outline"
                  size="sm"
                  render={<Link href={`/finance/purchase-orders/${encodeURIComponent(po)}`} />}
                >
                  View {po}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
