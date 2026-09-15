"use client"

import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { FinanceMaintenanceScreen } from "@/components/finance/FinanceMaintenanceScreen"
import { requisitionSpec } from "@/lib/forms/purchasing"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

/**
 * Requisition's Submit / Create Purchase Order(s) actions used to live on
 * a separate /finance/requisitions/[name] detail page (reached by
 * navigating off the list). Now that the list is FinanceMaintenanceScreen
 * (inline, no navigation), they're passed in via the `extra` slot instead,
 * fed the already-loaded doc rather than re-fetching it.
 */
export default function RequisitionsListPage() {
  return (
    <FinanceMaintenanceScreen
      spec={requisitionSpec}
      extra={(doc, mode) => {
        if (mode !== "view" || !doc?.name) return null
        return (
          <RequisitionActions
            name={String(doc.name)}
            docstatus={Number(doc.docstatus ?? 0)}
          />
        )
      }}
    />
  )
}

function RequisitionActions({ name, docstatus }: { name: string; docstatus: number }) {
  const queryClient = useQueryClient()

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(requisitionSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Requisition submitted")
      queryClient.invalidateQueries({ queryKey: [requisitionSpec.doctype] })
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

  return (
    <>
      <Separator className="mb-4" />

      {docstatus === 0 && (
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

      {docstatus === 1 && (
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
