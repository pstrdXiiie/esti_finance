"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { ChildTableGrid } from "@/components/sms/ChildTableGrid"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

/**
 * The ~23 legacy transaction-entry screens (blueprint §5.1): a header plus an
 * editable line-items grid representing one real business transaction
 * (Purchase Order, Payroll Run, GL Voucher, Assessment, Loan Application).
 * Whitelisted API methods own the business rules (blueprint §4.3) — this
 * component only collects input and calls them.
 */
export function EntryScreen({
  spec,
  name,
  basePath,
  onSaved,
  onCancel,
}: {
  spec: EntrySpec
  name?: string
  basePath?: string
  /** Called after a successful save, in addition to any basePath navigation. */
  onSaved?: () => void
  /**
   * Called when Cancel is pressed, rendering a Cancel button next to Save.
   * Used by callers that embed this screen inline (e.g. EntryListScreen's
   * inlineAdd) and just need to close the panel rather than navigate.
   */
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [syncedDoc, setSyncedDoc] = useState<Record<string, unknown> | undefined>(undefined)

  const { data: doc, isLoading } = useQuery({
    queryKey: [spec.doctype, name],
    queryFn: () => frappe.getDoc<Record<string, unknown>>(spec.doctype, name!),
    enabled: !!name,
  })

  const form = useForm<Record<string, unknown>>({
  defaultValues: spec.fields.reduce(
    (acc, f) => ({ ...acc, [f.fieldname]: doc?.[f.fieldname] ?? "" }),
    {}
  ),
  values: doc
    ? spec.fields.reduce(
        (acc, f) => ({ ...acc, [f.fieldname]: doc[f.fieldname] ?? "" }),
        {}
      )
    : undefined,
})
  // Bug fix: `rows` used to only ever be seeded from the initial `[]` state,
  // so opening an existing document with a child table (e.g. Curriculum
  // Subjects, Permit Subjects, Assessment Detail) rendered an empty grid and
  // silently wiped the child table on the next Save. Sync `rows` from the doc
  // whenever a new one loads, using React's "adjust state during render"
  // pattern (not an effect) so the corrected rows are ready for this render.
  if (spec.childTable && doc && doc !== syncedDoc) {
    setSyncedDoc(doc)
    const existing = doc[spec.childTable.fieldname]
    setRows(Array.isArray(existing) ? (existing as Array<Record<string, unknown>>) : [])
  }

  const status = (doc?.[spec.workflowActions ? "status" : ""] as string) ?? undefined

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = spec.childTable
        ? { ...values, [spec.childTable.fieldname]: rows }
        : values
      return name
        ? frappe.updateDoc(spec.doctype, name, payload)
        : (spec.primaryApi
            ? frappe.call(spec.primaryApi, payload)
            : frappe.createDoc(spec.doctype, payload))
    },
   onSuccess: (saved) => {
  toast.success(`${spec.title} saved`)
  queryClient.invalidateQueries({ queryKey: [spec.doctype] })
  if (!name && basePath) {
    const newName = (saved as { name?: string })?.name
    if (newName) router.push(`${basePath}/${encodeURIComponent(newName)}`)
  }
  onSaved?.()
},
    onError: (error) => toast.error(`Could not save ${spec.title}: ${getErrorMessage(error)}`),
  })

  const workflowMutation = useMutation({
    mutationFn: (action: string) =>
      frappe.call("frappe.model.workflow.apply_workflow", {
        doc: JSON.stringify({ doctype: spec.doctype, name }),
        action,
      }),
    onSuccess: (_, action) => {
      toast.success(`${action} applied`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype, name] })
    },
    onError: (error) => toast.error(`Workflow action failed: ${getErrorMessage(error)}`),
  })

  if (name && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{spec.title}</h1>
        {status && <Badge variant="outline">{status}</Badge>}
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          className="grid gap-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {spec.fields.map((f) => (
              <DynamicField key={f.fieldname} control={form.control} spec={f} />
            ))}
          </div>

          {spec.childTable && (
            <>
              <Separator />
              <ChildTableGrid
                spec={spec.childTable}
                rows={rows}
                onChange={setRows}
              />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {name &&
              spec.workflowActions?.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant="secondary"
                  disabled={workflowMutation.isPending}
                  onClick={() => workflowMutation.mutate(action)}
                >
                  {action}
                </Button>
              ))}
          </div>
        </form>
      </Form>
    </div>
  )
}