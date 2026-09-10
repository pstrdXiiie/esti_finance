"use client"

import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { overtimeSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface OvertimeDoc extends Record<string, unknown> {
  name: string
  docstatus: number
  status?: string
}

const listColumns = overtimeSpec.fields.filter((f) => f.inListView)

/**
 * Bespoke — replaces the generic EntryScreen. OvertimeWorkflowPanel is
 * moved over unchanged from the old personnel/overtime/[name]/page.tsx:
 * the "SMS Overtime Approval" Workflow drives status, so the only correct
 * way to move it is get_transitions/apply_workflow, never a raw field
 * update.
 *
 * Same docName-optional pattern as LoanApplicationEntry.tsx.
 */
export function OvertimeEntry({ docName }: { docName?: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: doc, isLoading } = useQuery({
    queryKey: [overtimeSpec.doctype, docName],
    queryFn: () => frappe.getDoc<OvertimeDoc>(overtimeSpec.doctype, docName!),
    enabled: !!docName,
  })

  const transitionsQuery = useQuery({
    queryKey: [overtimeSpec.doctype, docName, "transitions"],
    queryFn: () => frappe.getWorkflowTransitions(overtimeSpec.doctype, docName!),
    enabled: !!docName,
  })

  const recentQuery = useQuery({
    queryKey: [overtimeSpec.doctype, "list"],
    queryFn: () =>
      frappe.list<Record<string, unknown>>(overtimeSpec.doctype, {
        fields: ["name", ...overtimeSpec.fields.map((f) => f.fieldname)],
        order_by: "modified desc",
        limit_page_length: 20,
      }),
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: doc ?? {},
    values: doc,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      docName
        ? frappe.updateDoc(overtimeSpec.doctype, docName, values)
        : frappe.createDoc(overtimeSpec.doctype, values),
    onSuccess: (saved) => {
      toast.success(`${overtimeSpec.title} saved`)
      queryClient.invalidateQueries({ queryKey: [overtimeSpec.doctype] })
      if (!docName) {
        const newName = (saved as { name?: string } | undefined)?.name
        if (newName) {
          router.push(`/personnel/overtime/${encodeURIComponent(newName)}`)
        }
      }
    },
    onError: (error) =>
      toast.error(`Could not save ${overtimeSpec.title}: ${getErrorMessage(error)}`),
  })

  const workflowMutation = useMutation({
    mutationFn: (action: string) => frappe.applyWorkflowAction(overtimeSpec.doctype, docName!, action),
    onSuccess: (_, action) => {
      toast.success(`${action} applied`)
      queryClient.invalidateQueries({ queryKey: [overtimeSpec.doctype, docName] })
      queryClient.invalidateQueries({ queryKey: [overtimeSpec.doctype, docName, "transitions"] })
    },
    onError: (error) => toast.error(`Could not apply workflow action: ${getErrorMessage(error)}`),
  })

  if (docName && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="grid gap-6 w-full">
      <div className="w-full rounded-2xl border border-border p-7">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">{overtimeSpec.title}</h1>
          {doc?.status && <Badge variant="outline">{doc.status}</Badge>}
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="grid gap-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {overtimeSpec.fields.map((f) => (
                <DynamicField key={f.fieldname} control={form.control} spec={f} />
              ))}
            </div>
            <Button type="submit" className="w-fit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>

        {docName && (transitionsQuery.data?.length ?? 0) > 0 && (
          <>
            <Separator className="my-6" />
            <div className="grid gap-2 rounded-md border p-4">
              <h2 className="font-semibold">Workflow Actions</h2>
              <div className="flex flex-wrap gap-2">
                {transitionsQuery.data!.map((t) => (
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
        )}
      </div>

      <div className="w-full">
        <h2 className="text-lg font-semibold mb-3">Recent Overtime</h2>
        {recentQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {listColumns.map((c) => (
                    <TableHead key={c.fieldname}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentQuery.data ?? []).map((row) => (
                  <TableRow
                    key={String(row.name)}
                    className={
                      docName && String(row.name) === docName
                        ? "bg-muted/50"
                        : "cursor-pointer hover:bg-muted/30"
                    }
                    onClick={() => {
                      if (docName && String(row.name) === docName) return
                      router.push(`/personnel/overtime/${encodeURIComponent(String(row.name))}`)
                    }}
                  >
                    {listColumns.map((c) => (
                      <TableCell key={c.fieldname}>{String(row[c.fieldname] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {(recentQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={listColumns.length} className="text-muted-foreground text-center">
                      No overtime records yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
