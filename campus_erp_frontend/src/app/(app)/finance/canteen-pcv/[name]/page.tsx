"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { canteenPcvSpec } from "@/lib/forms/purchasing"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface CanteenPcvDoc {
  name: string
  docstatus: number
}

export default function CanteenPcvEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={canteenPcvSpec} name={docName} basePath="/finance/canteen-pcv" />
      {docName && <CanteenPcvActions name={docName} />}
    </div>
  )
}

/**
 * Bespoke Submit panel — a PCV must be submitted (docstatus 1) before it's
 * eligible for the replenishment voucher flow on the list page (see
 * create_replenishment_voucher's docstatus/replenished checks).
 */
function CanteenPcvActions({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [canteenPcvSpec.doctype, name],
    queryFn: () => frappe.getDoc<CanteenPcvDoc>(canteenPcvSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(canteenPcvSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("PCV submitted")
      queryClient.invalidateQueries({ queryKey: [canteenPcvSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit PCV: ${getErrorMessage(error)}`),
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
        <h2 className="font-semibold">Submit PCV</h2>
        <p className="text-sm text-muted-foreground">
          Submitting locks the voucher and makes it eligible for a replenishment run.
        </p>
        <Button
          type="button"
          className="w-fit"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit PCV"}
        </Button>
      </div>
    </>
  )
}
