"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { assetSpec } from "@/lib/forms/asset"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface AssetDoc {
  name: string
  docstatus: number
}

export default function AssetEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={assetSpec} name={docName} basePath="/asset/register" />
      {docName && <AssetActions name={docName} />}
    </div>
  )
}

/** Submit locks the asset record (a prerequisite for ERPNext's own
 * depreciation/GL posting) — same docstatus-PUT convention used across
 * this app's other submittable EntryScreens. */
function AssetActions({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [assetSpec.doctype, name],
    queryFn: () => frappe.getDoc<AssetDoc>(assetSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(assetSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Asset submitted")
      queryClient.invalidateQueries({ queryKey: [assetSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit asset: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />
  }
  if (!doc || doc.docstatus !== 0) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="grid gap-2 rounded-md border p-4">
        <h2 className="font-semibold">Submit Asset</h2>
        <p className="text-sm text-muted-foreground">
          Submitting locks the record and is required before depreciation/GL posting.
        </p>
        <Button
          type="button"
          className="w-fit"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit Asset"}
        </Button>
      </div>
    </>
  )
}
