"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { purchaseOrderSpec } from "@/lib/forms/purchasing"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface PurchaseOrderDoc {
  name: string
  docstatus: number
}

export default function PurchaseOrderEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={purchaseOrderSpec} name={docName} basePath="/finance/purchase-orders" />
      {docName && <PurchaseOrderActions name={docName} />}
    </div>
  )
}

/**
 * Bespoke Submit panel: Purchase Orders created by
 * create_purchase_orders_from_requisition are deliberately left as Draft
 * (the Purchasing Officer reviews and submits manually) and there's no
 * Frappe desk access from this app, so submitting has to happen here.
 */
function PurchaseOrderActions({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [purchaseOrderSpec.doctype, name],
    queryFn: () => frappe.getDoc<PurchaseOrderDoc>(purchaseOrderSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(purchaseOrderSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Purchase Order submitted")
      queryClient.invalidateQueries({ queryKey: [purchaseOrderSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit Purchase Order: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!doc || doc.docstatus !== 0) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="grid gap-2 rounded-md border p-4">
        <h2 className="font-semibold">Submit Purchase Order</h2>
        <p className="text-sm text-muted-foreground">
          Review items and totals in Frappe Desk first if anything looks off — this only
          flips docstatus.
        </p>
        <Button
          type="button"
          className="w-fit"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit Purchase Order"}
        </Button>
      </div>
    </>
  )
}
