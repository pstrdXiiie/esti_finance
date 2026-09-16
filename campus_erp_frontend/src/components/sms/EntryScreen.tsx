"use client"

import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { ChildTableField, WizardFormLayout } from "@/components/sms/WizardFormLayout"
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

  const { data: doc, isLoading } = useQuery({
    queryKey: [spec.doctype, name],
    queryFn: () => frappe.getDoc<Record<string, unknown>>(spec.doctype, name!),
    enabled: !!name,
  })

  // The child table's own field is seeded/reset here too (not just
  // spec.fields) so it round-trips entirely through react-hook-form's own
  // `values` reset — ChildTableField (see WizardFormLayout.tsx) registers it
  // via useController against this same `control`, the same mechanism as
  // every top-level field, rather than a second ad hoc copy kept in sync by
  // hand. That ad hoc copy is what used to cause opening an existing
  // document with a child table (e.g. Curriculum Subjects, Assessment
  // Detail) to render an empty grid and silently wipe it on the next Save.
  const form = useForm<Record<string, unknown>>({
  defaultValues: {
    ...spec.fields.reduce((acc, f) => ({ ...acc, [f.fieldname]: doc?.[f.fieldname] ?? "" }), {}),
    ...(spec.childTable ? { [spec.childTable.fieldname]: doc?.[spec.childTable.fieldname] ?? [] } : {}),
  },
  values: doc
    ? {
        ...spec.fields.reduce((acc, f) => ({ ...acc, [f.fieldname]: doc[f.fieldname] ?? "" }), {}),
        ...(spec.childTable ? { [spec.childTable.fieldname]: doc[spec.childTable.fieldname] ?? [] } : {}),
      }
    : undefined,
})

  const status = (doc?.[spec.workflowActions ? "status" : ""] as string) ?? undefined

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      return name
        ? frappe.updateDoc(spec.doctype, name, values)
        : (spec.primaryApi
            ? frappe.call(spec.primaryApi, values)
            : frappe.createDoc(spec.doctype, values))
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
            {spec.wizard ? (
              <WizardFormLayout
                spec={spec}
                layout={spec.wizard}
                control={form.control}
                setValue={form.setValue as (name: string, value: unknown) => void}
              />
            ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {spec.fields.map((f) => (
                  <DynamicField
                    key={f.fieldname}
                    control={form.control}
                    spec={f}
                    setValue={form.setValue as (name: string, value: unknown) => void}
                  />
                ))}
              </div>

              {spec.childTable && (
                <>
                  <Separator />
                  <ChildTableField spec={spec.childTable} control={form.control} />
                </>
              )}
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